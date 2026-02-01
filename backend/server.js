const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

function formatNeo4jDatetime(obj) {
if (!obj) return obj;
if (Array.isArray(obj)) {
return obj.map(item => formatNeo4jDatetime(item));
}
if (typeof obj === 'object') {
const formatted = {};
for (const [key, value] of Object.entries(obj)) {
if (value && typeof value === 'object' && value.year && value.month && value.day) {
formatted[key] = `${value.year.low}-${String(value.month.low).padStart(2, '0')}-${String(value.day.low).padStart(2, '0')}T${String(value.hour.low).padStart(2, '0')}:${String(value.minute.low).padStart(2, '0')}:${String(value.second.low).padStart(2, '0')}Z`;
} else {
formatted[key] = formatNeo4jDatetime(value);
}
}
return formatted;
}
return obj;
}

const driver = neo4j.driver(
process.env.NEO4J_URI || 'bolt://localhost:7687',
neo4j.auth.basic(
process.env.NEO4J_USER || 'neo4j',
process.env.NEO4J_PASSWORD || 'password123'
)
);

driver.getServerInfo()
.then(info => {
console.log('✅ Neo4j povezan:', info.address);
})
.catch(err => {
console.error('❌ Neo4j greška:', err);
});

app.post('/api/players', async (req, res) => {
const session = driver.session();
try {
const { username, email, age, password } = req.body;
if (!username || !email || !password) {
return res.status(400).json({ error: 'Username, email i password su obavezni' });
}
if (username.length < 3) {
return res.status(400).json({ error: 'Username mora imati minimum 3 karaktera' });
}
if (password.length < 6) {
return res.status(400).json({ error: 'Password mora imati minimum 6 karaktera' });
}
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
return res.status(400).json({ error: 'Neispravan email format' });
}
const existingUser = await session.run(
`MATCH (p:Player {username: $username}) RETURN p`,
{ username }
);
if (existingUser.records.length > 0) {
return res.status(409).json({ error: 'Username već postoji' });
}
const existingEmail = await session.run(
`MATCH (p:Player {email: $email}) RETURN p`,
{ email }
);
if (existingEmail.records.length > 0) {
return res.status(409).json({ error: 'Email već postoji' });
}
const result = await session.run(
`CREATE (p:Player {
username: $username,
email: $email,
age: $age,
password: $password,
createdAt: datetime()
})
RETURN p`,
{ username, email, age: age || 18, password }
);
const player = result.records[0].get('p').properties;
delete player.password;
if (player.createdAt) {
player.createdAt = player.createdAt.toString();
}
res.status(201).json({
message: 'Nalog uspešno kreiran',
player: player
});
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/players/login', async (req, res) => {
const session = driver.session();
try {
const { username, password } = req.body;
if (!username || !password) {
return res.status(400).json({ error: 'Username i password su obavezni' });
}
const result = await session.run(
`MATCH (p:Player {username: $username, password: $password})
RETURN p`,
{ username, password }
);
if (result.records.length === 0) {
return res.status(401).json({ error: 'Pogrešan username ili password' });
}
const player = result.records[0].get('p').properties;
delete player.password;
if (player.createdAt) {
player.createdAt = player.createdAt.toString();
}
res.json({
message: 'Uspešno logovanje',
player: player
});
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/players', async (req, res) => {
const session = driver.session();
try {
const result = await session.run(
`MATCH (p:Player) RETURN p ORDER BY p.username`
);
const players = result.records.map(record => {
const player = record.get('p').properties;
return formatNeo4jDatetime(player);
});
res.json(players);
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/players/:username', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const result = await session.run(
`MATCH (p:Player {username: $username}) RETURN p`,
{ username }
);
if (result.records.length === 0) {
return res.status(404).json({ error: 'Igrač ne postoji' });
}
const player = result.records[0].get('p').properties;
res.json(formatNeo4jDatetime(player));
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/players/:username/profile', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const playerResult = await session.run(
`MATCH (p:Player {username: $username}) RETURN p`,
{ username }
);
if (playerResult.records.length === 0) {
return res.status(404).json({ error: 'Player not found' });
}
const player = playerResult.records[0].get('p').properties;
delete player.password;
if (player.createdAt) {
player.createdAt = player.createdAt.toString();
}
const allGamesResult = await session.run(
`MATCH (p:Player {username: $username})-[r:RATED]->(g:Game)
RETURN g.title as title, g.genre as genre, r.score as rating,
COALESCE(r.ratedAt, r.addedAt) as date
ORDER BY date DESC`,
{ username }
);
const allGames = allGamesResult.records.map(record => ({
title: record.get('title'),
genre: record.get('genre'),
rating: record.get('rating')
}));
const topRatedGames = allGames.filter(g => g.rating !== null && g.rating !== undefined).slice(0, 10);
const followsResult = await session.run(
`MATCH (p:Player {username: $username})-[:FOLLOWS]->(other:Player)
RETURN COUNT(other) as count`,
{ username }
);
const followsCount = followsResult.records[0]?.get('count').toNumber() || 0;
const friendsResult = await session.run(
`MATCH (p:Player {username: $username})-[:FOLLOWS]->(friend:Player)
RETURN friend.username as username, friend.email as email
LIMIT 20`,
{ username }
);
const friendsList = friendsResult.records.map(record => ({
username: record.get('username'),
email: record.get('email')
}));
const ratedGamesCount = allGames.filter(g => g.rating !== null && g.rating !== undefined).length;
const avgRating = ratedGamesCount > 0
? allGames.filter(g => g.rating !== null && g.rating !== undefined).reduce((sum, g) => sum + g.rating, 0) / ratedGamesCount
: 0;
res.json({
player,
allGames,
topRatedGames,
friendsList,
stats: {
ratedGamesCount,
followsCount,
averageRating: avgRating.toFixed(2)
}
});
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/players/:username/change-password', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const { currentPassword, newPassword } = req.body;
const result = await session.run(
`MATCH (p:Player {username: $username, password: $currentPassword})
RETURN p`,
{ username, currentPassword }
);
if (result.records.length === 0) {
return res.status(401).json({ error: 'Current password is incorrect' });
}
await session.run(
`MATCH (p:Player {username: $username})
SET p.password = $newPassword
RETURN p`,
{ username, newPassword }
);
res.json({ message: 'Password changed successfully' });
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/players/:username/add-game', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const { gameTitle } = req.body;
await session.run(
`MATCH (p:Player {username: $username})
MATCH (g:Game {title: $gameTitle})
MERGE (p)-[r:RATED]->(g)
ON CREATE SET r.addedAt = datetime()
RETURN p, g, r`,
{ username, gameTitle }
);
res.json({ message: 'Game added successfully' });
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/games', async (req, res) => {
const session = driver.session();
try {
const { title, genre, releaseYear } = req.body;
const result = await session.run(
`CREATE (g:Game {title: $title, genre: $genre, releaseYear: $releaseYear})
RETURN g`,
{ title, genre, releaseYear }
);
res.json(result.records[0].get('g').properties);
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/games', async (req, res) => {
const session = driver.session();
try {
const result = await session.run(
`MATCH (g:Game) RETURN g ORDER BY g.title`
);
const games = result.records.map(record => record.get('g').properties);
res.json(games);
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/players/:username/follow', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const { targetUsername } = req.body;
const result = await session.run(
`MATCH (p1:Player {username: $username})
MATCH (p2:Player {username: $targetUsername})
MERGE (p1)-[f:FOLLOWS]->(p2)
RETURN p1, p2, f`,
{ username, targetUsername }
);
if (result.records.length === 0) {
return res.status(404).json({ error: 'Jedan od igrača ne postoji' });
}
res.json({ message: `${username} sada prati ${targetUsername}` });
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/players/:username/unfollow', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const { targetUsername } = req.body;
await session.run(
`MATCH (p1:Player {username: $username})-[f:FOLLOWS]->(p2:Player {username: $targetUsername})
DELETE f`,
{ username, targetUsername }
);
res.json({ message: `${username} je prestao da prati ${targetUsername}` });
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/players/:username/is-following/:targetUsername', async (req, res) => {
const session = driver.session();
try {
const { username, targetUsername } = req.params;
const result = await session.run(
`MATCH (p1:Player {username: $username})-[f:FOLLOWS]->(p2:Player {username: $targetUsername})
RETURN f`,
{ username, targetUsername }
);
res.json({ isFollowing: result.records.length > 0 });
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/players/:username/block', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const { targetUsername } = req.body;
await session.run(
`MATCH (p1:Player {username: $username})
MATCH (p2:Player {username: $targetUsername})
MERGE (p1)-[b:BLOCKS]->(p2)
RETURN b`,
{ username, targetUsername }
);
res.json({ message: `${username} je blokirao ${targetUsername}` });
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/players/:username/rate', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const { gameTitle, rating } = req.body;
if (rating < 1 || rating > 5) {
return res.status(400).json({ error: 'Ocena mora biti između 1 i 5' });
}
const result = await session.run(
`MATCH (p:Player {username: $username})
MATCH (g:Game {title: $gameTitle})
MERGE (p)-[r:RATED]->(g)
SET r.score = $rating, r.ratedAt = datetime()
RETURN r`,
{ username, gameTitle, rating }
);
res.json({ message: `${username} je ocenio ${gameTitle} sa ${rating}/5` });
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/players/:username/favorite', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const { gameTitle } = req.body;
await session.run(
`MATCH (p:Player {username: $username})
MATCH (g:Game {title: $gameTitle})
MERGE (p)-[f:FAVORITE]->(g)
SET f.addedAt = datetime()
RETURN f`,
{ username, gameTitle }
);
res.json({ message: `${gameTitle} dodato u favorite` });
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/players/:username/recommendations/friends', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const result = await session.run(
`MATCH (me:Player {username: $username})-[:FOLLOWS]->(friend:Player)-[r:RATED]->(game:Game)
WHERE NOT (me)-[:RATED]->(game)
AND NOT (me)-[:BLOCKS]->(friend)
AND r.score >= 4
RETURN game.title AS title, game.genre AS genre,
AVG(r.score) AS avgRating,
COUNT(friend) AS friendCount
ORDER BY avgRating DESC, friendCount DESC
LIMIT 10`,
{ username }
);
const recommendations = result.records.map(record => ({
title: record.get('title'),
genre: record.get('genre'),
avgRating: record.get('avgRating'),
friendCount: record.get('friendCount').toNumber()
}));
res.json(recommendations);
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/players/:username/recommendations/extended', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const result = await session.run(
`MATCH (me:Player {username: $username})-[:FOLLOWS*1..2]->(player:Player)-[r:RATED]->(game:Game)
WHERE NOT (me)-[:RATED]->(game)
AND NOT (me)-[:BLOCKS]->(player)
AND r.score >= 4
RETURN game.title AS title, game.genre AS genre,
AVG(r.score) AS avgRating,
COUNT(DISTINCT player) AS playerCount
ORDER BY avgRating DESC, playerCount DESC
LIMIT 10`,
{ username }
);
const recommendations = result.records.map(record => ({
title: record.get('title'),
genre: record.get('genre'),
avgRating: record.get('avgRating'),
playerCount: record.get('playerCount').toNumber()
}));
res.json(recommendations);
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/players/:username/recommendations/similar', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const result = await session.run(
`MATCH (me:Player {username: $username})-[myRating:RATED]->(game:Game)<-[theirRating:RATED]-(other:Player)
WHERE ABS(myRating.score - theirRating.score) <= 1
AND NOT (me)-[:BLOCKS]->(other)
WITH other, COUNT(game) AS commonGames
WHERE commonGames >= 2
MATCH (other)-[r:RATED]->(recommendedGame:Game)
WHERE NOT (me)-[:RATED]->(recommendedGame)
AND r.score >= 4
RETURN recommendedGame.title AS title, recommendedGame.genre AS genre,
AVG(r.score) AS avgRating,
COUNT(DISTINCT other) AS similarPlayers
ORDER BY avgRating DESC, similarPlayers DESC
LIMIT 10`,
{ username }
);
const recommendations = result.records.map(record => ({
title: record.get('title'),
genre: record.get('genre'),
avgRating: record.get('avgRating'),
similarPlayers: record.get('similarPlayers').toNumber()
}));
res.json(recommendations);
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/social-graph', async (req, res) => {
const session = driver.session();
try {
const { username, gameTitle } = req.body;
const playersResult = await session.run(
`MATCH (p:Player)-[:RATED]->(g:Game {title: $gameTitle})
WHERE p.username <> $username
RETURN DISTINCT p.username AS username
ORDER BY p.username
LIMIT 30`,
{ username, gameTitle }
);
const players = playersResult.records.map(record => ({
username: record.get('username')
}));
if (players.length === 0) {
return res.json({ players: [], connections: [] });
}
const allUsernames = [username, ...players.map(p => p.username)];
const connectionsResult = await session.run(
`MATCH (p1:Player)-[f:FOLLOWS]->(p2:Player)
WHERE p1.username IN $usernames AND p2.username IN $usernames
RETURN p1.username AS from, p2.username AS to`,
{ usernames: allUsernames }
);
const connections = connectionsResult.records.map(record => ({
from: record.get('from'),
to: record.get('to')
}));
console.log(`📊 Social graph za ${gameTitle}:`, {
players: players.length,
connections: connections.length
});
res.json({
players,
connections
});
} catch (error) {
console.error('Social graph error:', error);
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/players/:username/network', async (req, res) => {
const session = driver.session();
try {
const { username } = req.params;
const result = await session.run(
`MATCH (me:Player {username: $username})
OPTIONAL MATCH (me)-[r:FOLLOWS|BLOCKS|FAVORITE]->(target)
RETURN me, collect({type: type(r), target: target}) AS relationships`,
{ username }
);
const data = result.records[0];
res.json({
player: data.get('me').properties,
relationships: data.get('relationships')
});
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/topics', async (req, res) => {
const session = driver.session();
try {
const { title, content, category, authorUsername } = req.body;
if (!title || !content || !category || !authorUsername) {
return res.status(400).json({ error: 'Sva polja su obavezna' });
}
const existingTopic = await session.run(
`MATCH (t:Topic {title: $title}) RETURN t`,
{ title }
);
if (existingTopic.records.length > 0) {
return res.status(409).json({ error: 'Topic sa ovim naslovom već postoji' });
}
const result = await session.run(
`MATCH (p:Player {username: $authorUsername})
CREATE (t:Topic {
id: randomUUID(),
title: $title,
content: $content,
category: $category,
authorUsername: $authorUsername,
createdAt: datetime(),
updatedAt: datetime()
})
CREATE (p)-[:CREATED]->(t)
RETURN t`,
{ title, content, category, authorUsername }
);
const topic = result.records[0].get('t').properties;
res.status(201).json(formatNeo4jDatetime(topic));
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/topics', async (req, res) => {
const session = driver.session();
try {
const { category, page = 1, limit = 10 } = req.query;
const skip = (parseInt(page) - 1) * parseInt(limit);
let query = `MATCH (t:Topic)`;
let params = { skip: neo4j.int(skip), limit: neo4j.int(parseInt(limit)) };
if (category && category !== 'all') {
query += ` WHERE t.category = $category`;
params.category = category;
}
query += `
OPTIONAL MATCH (t)<-[:BELONGS_TO]-(c:Comment)
WITH t, COUNT(c) as commentCount
RETURN t, commentCount
ORDER BY t.createdAt DESC
SKIP $skip
LIMIT $limit`;
const result = await session.run(query, params);
const topics = result.records.map(record => {
const topic = formatNeo4jDatetime(record.get('t').properties);
topic.commentCount = record.get('commentCount').toNumber();
return topic;
});
let countQuery = `MATCH (t:Topic)`;
let countParams = {};
if (category && category !== 'all') {
countQuery += ` WHERE t.category = $category`;
countParams.category = category;
}
countQuery += ` RETURN COUNT(t) as total`;
const countResult = await session.run(countQuery, countParams);
const total = countResult.records[0].get('total').toNumber();
res.json({
topics,
total,
page: parseInt(page),
totalPages: Math.ceil(total / parseInt(limit))
});
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/topics/search', async (req, res) => {
const session = driver.session();
try {
const { q } = req.query;
if (!q || q.trim().length < 1) {
return res.json({ topics: [] });
}
const result = await session.run(
`MATCH (t:Topic)
WHERE toLower(t.title) CONTAINS toLower($query) OR toLower(t.content) CONTAINS toLower($query)
OPTIONAL MATCH (t)<-[:BELONGS_TO]-(c:Comment)
WITH t, COUNT(c) as commentCount
RETURN t, commentCount
ORDER BY t.createdAt DESC
LIMIT 50`,
{ query: q.trim() }
);
const topics = result.records.map(record => {
const topic = formatNeo4jDatetime(record.get('t').properties);
topic.commentCount = record.get('commentCount').toNumber();
return topic;
});
res.json({ topics });
} catch (error) {
console.error('Topic search error:', error);
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/users/search', async (req, res) => {
const session = driver.session();
try {
const { q } = req.query;
if (!q || q.trim().length < 1) {
return res.json({ users: [] });
}
const result = await session.run(
`MATCH (p:Player)
WHERE toLower(p.username) CONTAINS toLower($query) OR toLower(p.email) CONTAINS toLower($query)
OPTIONAL MATCH (p)-[:FOLLOWS]->(friend:Player)
WITH p, COUNT(friend) as friendsCount
OPTIONAL MATCH (p)-[:RATED]->(g:Game)
WITH p, friendsCount, COUNT(g) as gamesCount
RETURN p.username as username, 
p.email as email, 
friendsCount, 
gamesCount
ORDER BY p.username
LIMIT 50`,
{ query: q.trim() }
);
const users = result.records.map(record => ({
username: record.get('username'),
email: record.get('email'),
friendsCount: record.get('friendsCount').toNumber(),
gamesCount: record.get('gamesCount').toNumber()
}));
res.json({ users });
} catch (error) {
console.error('User search error:', error);
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/topics/:id', async (req, res) => {
const session = driver.session();
try {
const { id } = req.params;
const result = await session.run(
`MATCH (t:Topic {id: $id})
RETURN t`,
{ id }
);
if (result.records.length === 0) {
return res.status(404).json({ error: 'Topic ne postoji' });
}
const topic = formatNeo4jDatetime(result.records[0].get('t').properties);
res.json(topic);
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.put('/api/topics/:id', async (req, res) => {
const session = driver.session();
try {
const { id } = req.params;
const { content, category, username } = req.body;
const checkResult = await session.run(
`MATCH (t:Topic {id: $id, authorUsername: $username})
RETURN t`,
{ id, username }
);
if (checkResult.records.length === 0) {
return res.status(403).json({ error: 'Nemate pravo da menjate ovaj topic' });
}
const result = await session.run(
`MATCH (t:Topic {id: $id})
SET t.content = $content,
t.category = $category,
t.updatedAt = datetime()
RETURN t`,
{ id, content, category }
);
const topic = formatNeo4jDatetime(result.records[0].get('t').properties);
res.json(topic);
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.delete('/api/topics/:id', async (req, res) => {
const session = driver.session();
try {
const { id } = req.params;
const { username } = req.body;
const checkResult = await session.run(
`MATCH (t:Topic {id: $id, authorUsername: $username})
RETURN t`,
{ id, username }
);
if (checkResult.records.length === 0) {
return res.status(403).json({ error: 'Nemate pravo da obrišete ovaj topic' });
}
await session.run(
`MATCH (t:Topic {id: $id})
OPTIONAL MATCH (t)<-[:BELONGS_TO]-(c:Comment)
DETACH DELETE t, c`,
{ id }
);
res.json({ message: 'Topic obrisan' });
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/topics/:id/comments', async (req, res) => {
const session = driver.session();
try {
const { id } = req.params;
const { content, authorUsername } = req.body;
if (!content || !authorUsername) {
return res.status(400).json({ error: 'Content i authorUsername su obavezni' });
}
const result = await session.run(
`MATCH (t:Topic {id: $topicId})
MATCH (p:Player {username: $authorUsername})
CREATE (c:Comment {
id: randomUUID(),
content: $content,
authorUsername: $authorUsername,
createdAt: datetime()
})
CREATE (p)-[:COMMENTED]->(c)
CREATE (c)-[:BELONGS_TO]->(t)
RETURN c`,
{ topicId: id, content, authorUsername }
);
const comment = formatNeo4jDatetime(result.records[0].get('c').properties);
res.status(201).json(comment);
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.get('/api/topics/:id/comments', async (req, res) => {
const session = driver.session();
try {
const { id } = req.params;
const result = await session.run(
`MATCH (t:Topic {id: $topicId})<-[:BELONGS_TO]-(c:Comment)
RETURN c
ORDER BY c.createdAt ASC`,
{ topicId: id }
);
const comments = result.records.map(record => formatNeo4jDatetime(record.get('c').properties));
res.json(comments);
} catch (error) {
res.status(500).json({ error: error.message });
} finally {
await session.close();
}
});

app.post('/api/social-graph/depth', async (req, res) => {
    const session = driver.session();
    try {
      const { username, gameTitle } = req.body;
      
      if (!gameTitle) {
        return res.status(400).json({ error: 'Game title is required' });
      }
  
      const depth1Result = await session.run(
        `MATCH (me:Player {username: $username})-[:RATED]->(game:Game {title: $gameTitle})
         MATCH (me)-[:FOLLOWS]->(connected:Player)-[:RATED]->(game)
         WHERE connected.username <> $username
         RETURN DISTINCT connected.username as username, 1 as depth`,
        { username, gameTitle }
      );
  
      const depth2Result = await session.run(
        `MATCH (me:Player {username: $username})-[:RATED]->(game:Game {title: $gameTitle})
         MATCH (me)-[:FOLLOWS]->()-[:FOLLOWS]->(connected:Player)-[:RATED]->(game)
         WHERE connected.username <> $username
         AND NOT (me)-[:FOLLOWS]->(connected)
         RETURN DISTINCT connected.username as username, 2 as depth`,
        { username, gameTitle }
      );
  
      const depth3Result = await session.run(
        `MATCH (me:Player {username: $username})-[:RATED]->(game:Game {title: $gameTitle})
         MATCH (me)-[:FOLLOWS]->()-[:FOLLOWS]->()-[:FOLLOWS]->(connected:Player)-[:RATED]->(game)
         WHERE connected.username <> $username
         AND NOT (me)-[:FOLLOWS]->(connected)
         AND NOT (me)-[:FOLLOWS]->()-[:FOLLOWS]->(connected)
         RETURN DISTINCT connected.username as username, 3 as depth`,
        { username, gameTitle }
      );
  
      const connections = [
        ...depth1Result.records.map(r => ({ username: r.get('username'), depth: 1 })),
        ...depth2Result.records.map(r => ({ username: r.get('username'), depth: 2 })),
        ...depth3Result.records.map(r => ({ username: r.get('username'), depth: 3 }))
      ];
  
      const allUsernames = [username, ...connections.map(c => c.username)];
      
      const edgesResult = await session.run(
        `MATCH (p1:Player)-[:FOLLOWS]->(p2:Player)
         WHERE p1.username IN $usernames AND p2.username IN $usernames
         RETURN DISTINCT p1.username as from, p2.username as to`,
        { usernames: allUsernames }
      );
  
      const edges = edgesResult.records.map(record => ({
        from: record.get('from'),
        to: record.get('to')
      }));
  
      res.json({
        connections,
        edges
      });
    } catch (error) {
      console.error('Social graph depth error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  

app.get('/health', (req, res) => {
res.json({ status: 'OK', timestamp: new Date() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
console.log(`🚀 Backend radi na http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
await driver.close();
process.exit(0);
});
