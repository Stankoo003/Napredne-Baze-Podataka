const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});


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

const cassandraInit = require('./cassandra-init');
let cassandraReady = false;
let cassandraClient = null;

(async function initCassandraWithRetry() {
  let retries = 10;
  while (retries > 0) {
    try {
      cassandraClient = await cassandraInit.initCassandra();
      cassandraReady = true;
      console.log('✅ Cassandra spremna za upotrebu');
      break;
    } catch (error) {
      retries--;
      console.log(`⏳ Čekam Cassandra... (preostalo pokušaja: ${retries})`);
      if (retries === 0) {
        console.error('❌ Cassandra nije dostupna nakon 10 pokušaja:', error.message);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
})();

async function addActivityPoints(username, activityType, points) {
  if (!cassandraReady || !cassandraClient) {
    console.log('⚠️ Cassandra nije dostupna za activity tracking');
    return;
  }
  
  try {
    const logQuery = `
      INSERT INTO activity_log (username, activity_type, points, timestamp)
      VALUES (?, ?, ?, toTimestamp(now()))
    `;
    await cassandraClient.execute(logQuery, [username, activityType, points], { prepare: true });
    
    const currentResult = await cassandraClient.execute(
      'SELECT total_score FROM global_leaderboard WHERE username = ?',
      [username],
      { prepare: true }
    );
    
    const currentScore = currentResult.rows.length > 0 
      ? Number(currentResult.rows[0].total_score) 
      : 0;
    
    const newScore = currentScore + points;
    
    const updateQuery = `
      UPDATE global_leaderboard 
      SET total_score = ?, updated_at = toTimestamp(now())
      WHERE username = ?
    `;
    await cassandraClient.execute(updateQuery, [newScore, username], { prepare: true });
    
    console.log(`✅ Activity tracked: ${username} earned ${points} points for ${activityType} (total: ${newScore})`);
  } catch (error) {
    console.error(`❌ Error tracking activity:`, error.message);
  }
}

async function syncPlayerToCassandra(username) {
  if (!cassandraReady || !cassandraClient) {
    console.log('⚠️ Cassandra nije dostupna za sync');
    return;
  }
  
  const session = driver.session();
  try {
    const profileResult = await session.run(
      `MATCH (p:Player {username: $username})-[r:RATED]->(g:Game)
       RETURN g.title as title, r.score as rating`,
      { username }
    );
    
    const games = profileResult.records.map(record => ({
      title: record.get('title'),
      rating: record.get('rating')
    }));
    
    const ratedGames = games.filter(g => g.rating !== null && g.rating !== undefined);
    const avgRating = ratedGames.length > 0 
      ? ratedGames.reduce((sum, g) => sum + g.rating, 0) / ratedGames.length 
      : 0;
    
    const currentResult = await cassandraClient.execute(
      'SELECT total_score FROM global_leaderboard WHERE username = ?',
      [username],
      { prepare: true }
    );
    
    const totalScore = currentResult.rows.length > 0 
      ? Number(currentResult.rows[0].total_score)
      : 0;
    
    const globalQuery = `
      INSERT INTO global_leaderboard (username, total_score, games_played, avg_rating, updated_at)
      VALUES (?, ?, ?, ?, toTimestamp(now()))
    `;
    await cassandraClient.execute(globalQuery, [username, totalScore, ratedGames.length, avgRating], { prepare: true });
    
    console.log(`✅ Cassandra: Global leaderboard updated for ${username} (games: ${ratedGames.length}, avg: ${avgRating})`);
  } catch (error) {
    console.error(`❌ Cassandra sync error for ${username}:`, error.message);
  } finally {
    await session.close();
  }
}

async function syncGameRatingToCassandra(username, gameTitle, score) {
  if (!cassandraReady || !cassandraClient) {
    console.log('⚠️ Cassandra nije dostupna za sync');
    return;
  }
  
  try {
    const gameQuery = `
      INSERT INTO game_leaderboard (game_title, username, score, updated_at)
      VALUES (?, ?, ?, toTimestamp(now()))
    `;
    await cassandraClient.execute(gameQuery, [gameTitle, username, score], { prepare: true });
    
    console.log(`✅ Cassandra: Game leaderboard updated for ${username} - ${gameTitle}`);
  } catch (error) {
    console.error(`❌ Cassandra game sync error:`, error.message);
  }
}

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
    
    await syncPlayerToCassandra(username);
    
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

app.post('/api/players/:username/upload-avatar', upload.single('avatar'), async (req, res) => {
  const session = driver.session();
  try {
    const { username } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const avatarUrl = `/uploads/${req.file.filename}`;
    
    // Update player's avatar in Neo4j
    await session.run(
      `MATCH (p:Player {username: $username})
       SET p.avatar = $avatarUrl
       RETURN p`,
      { username, avatarUrl }
    );
    
    res.json({ 
      message: 'Avatar uploaded successfully',
      avatarUrl 
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// Get player avatar
app.get('/api/players/:username/avatar', async (req, res) => {
  const session = driver.session();
  try {
    const { username } = req.params;
    
    const result = await session.run(
      `MATCH (p:Player {username: $username})
       RETURN p.avatar as avatar`,
      { username }
    );
    
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const avatar = result.records[0].get('avatar');
    res.json({ avatar: avatar || null });
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
    
    await syncPlayerToCassandra(username);
    await addActivityPoints(username, 'add_game', 50);
    
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
    
    await syncPlayerToCassandra(username);
    await addActivityPoints(username, 'add_friend', 80);
    
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
    
    await syncPlayerToCassandra(username);
    
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
    
    await syncPlayerToCassandra(username);
    await syncGameRatingToCassandra(username, gameTitle, rating);
    await addActivityPoints(username, 'rate_game', 100);
    
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

app.get('/api/users/search', async (req, res) => {
  const session = driver.session();
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
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
              p.avatar as avatar,
              friendsCount, 
              gamesCount
       ORDER BY p.username
       LIMIT 50`,
      { query: q.trim() }
    );
    
    const users = result.records.map(record => ({
      username: record.get('username'),
      email: record.get('email'),
      avatar: record.get('avatar'),
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


app.post('/api/topics', async (req, res) => {
  const session = driver.session();
  try {
    const { title, content, category, authorUsername } = req.body;
    
    if (!title || !content || !authorUsername) {
      return res.status(400).json({ error: 'Sva polja su obavezna' });
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
    
    const topic = formatNeo4jDatetime(result.records[0].get('t').properties);
    
    await addActivityPoints(authorUsername, 'create_topic', 150);
    
    res.status(201).json(topic);
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
    let params = {};
    
    if (category && category !== 'all') {
      query += ` WHERE t.category = $category`;
      params.category = category;
    }
    
    query += ` OPTIONAL MATCH (c:Comment)-[:BELONGS_TO]->(t)
               WITH t, COUNT(c) as commentCount
               RETURN t, commentCount
               ORDER BY t.createdAt DESC
               SKIP ${skip} LIMIT ${parseInt(limit)}`;
    
    console.log('📋 Executing query:', query);
    console.log('📋 With params:', params);
    
    const result = await session.run(query, params);
    
    console.log('✅ Found topics:', result.records.length);
    
    const topics = result.records.map(record => {
      const topic = formatNeo4jDatetime(record.get('t').properties);
      topic.commentCount = record.get('commentCount').toNumber();
      return topic;
    });
    
    // Count query
    let countQuery = `MATCH (t:Topic)`;
    let countParams = {};
    if (category && category !== 'all') {
      countQuery += ` WHERE t.category = $category`;
      countParams.category = category;
    }
    countQuery += ` RETURN count(t) as total`;
    
    const countResult = await session.run(countQuery, countParams);
    const total = countResult.records[0].get('total').toNumber();
    
    console.log('📊 Total topics:', total);
    
    res.json({
      topics,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('❌ Error fetching topics:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});


app.get('/api/topics/search', async (req, res) => {
  const session = driver.session();
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ topics: [] });
    }
    const result = await session.run(
      `MATCH (t:Topic)
       WHERE toLower(t.title) CONTAINS toLower($query) OR toLower(t.content) CONTAINS toLower($query)
       RETURN t
       ORDER BY t.createdAt DESC
       LIMIT 10`,
      { query: q.trim() }
    );
    const topics = result.records.map(record => formatNeo4jDatetime(record.get('t').properties));
    res.json({ topics });
  } catch (error) {
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
      `MATCH (t:Topic {id: $id}) RETURN t`,
      { id }
    );
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Topic nije pronađen' });
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
      return res.status(403).json({ error: 'Nemate pravo da izmenite ovaj topic' });
    }
    await session.run(
      `MATCH (t:Topic {id: $id})
       SET t.content = $content, t.category = $category, t.updatedAt = datetime()
       RETURN t`,
      { id, content, category }
    );
    res.json({ message: 'Topic uspešno ažuriran' });
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
    
    await addActivityPoints(authorUsername, 'comment', 75);
    
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

app.post('/api/stats/player', async (req, res) => {
  if (!cassandraReady) {
    return res.status(503).json({ error: 'Cassandra nije dostupna' });
  }
  try {
    const { username, gameTitle, playtime, achievementsCount, level } = req.body;
    const query = `
      INSERT INTO player_stats (username, game_title, total_playtime, last_played, achievements_count, level)
      VALUES (?, ?, ?, toTimestamp(now()), ?, ?)
    `;
    await cassandraClient.execute(query, [username, gameTitle, playtime || 0, achievementsCount || 0, level || 1], { prepare: true });
    res.json({ message: 'Player stats updated successfully' });
  } catch (error) {
    console.error('Cassandra error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/player/:username', async (req, res) => {
  if (!cassandraReady) {
    return res.status(503).json({ error: 'Cassandra nije dostupna' });
  }
  try {
    const { username } = req.params;
    const query = 'SELECT * FROM player_stats WHERE username = ?';
    const result = await cassandraClient.execute(query, [username], { prepare: true });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/leaderboard/game', async (req, res) => {
  if (!cassandraReady) {
    return res.status(503).json({ error: 'Cassandra nije dostupna' });
  }
  try {
    const { gameTitle, username, score } = req.body;
    const query = `
      INSERT INTO game_leaderboard (game_title, username, score, updated_at)
      VALUES (?, ?, ?, toTimestamp(now()))
    `;
    await cassandraClient.execute(query, [gameTitle, username, score], { prepare: true });
    res.json({ message: 'Leaderboard updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leaderboard/game/:gameTitle', async (req, res) => {
  if (!cassandraReady) {
    return res.status(503).json({ error: 'Cassandra nije dostupna' });
  }
  try {
    const { gameTitle } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const query = 'SELECT * FROM game_leaderboard WHERE game_title = ? LIMIT ?';
    const result = await cassandraClient.execute(query, [gameTitle, limit], { prepare: true });
    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      username: row.username,
      score: row.score,
      updatedAt: row.updated_at
    }));
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leaderboard/global', async (req, res) => {
  if (!cassandraReady) {
    return res.status(503).json({ error: 'Cassandra nije dostupna' });
  }
  
  const session = driver.session();
  try {
    const query = 'SELECT * FROM global_leaderboard LIMIT 100';
    const result = await cassandraClient.execute(query);
    
    // Fetch avatars from Neo4j
    const usernames = result.rows.map(row => row.username);
    const avatarResult = await session.run(
      `MATCH (p:Player)
       WHERE p.username IN $usernames
       RETURN p.username as username, p.avatar as avatar`,
      { usernames }
    );
    
    const avatarMap = {};
    avatarResult.records.forEach(record => {
      avatarMap[record.get('username')] = record.get('avatar');
    });
    
    const leaderboard = result.rows
      .sort((a, b) => Number(b.total_score) - Number(a.total_score))
      .map((row, index) => ({
        rank: index + 1,
        username: row.username,
        avatar: avatarMap[row.username] || null,
        totalScore: Number(row.total_score),
        gamesPlayed: row.games_played,
        avgRating: Number(row.avg_rating),
        updatedAt: row.updated_at
      }));
    
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});


app.get('/api/leaderboard/global', async (req, res) => {
  if (!cassandraReady) {
    return res.status(503).json({ error: 'Cassandra nije dostupna' });
  }
  try {
    const query = 'SELECT * FROM global_leaderboard LIMIT 100';
    const result = await cassandraClient.execute(query);
    const leaderboard = result.rows
      .sort((a, b) => Number(b.total_score) - Number(a.total_score))
      .map((row, index) => ({
        rank: index + 1,
        username: row.username,
        totalScore: Number(row.total_score),
        gamesPlayed: row.games_played,
        avgRating: Number(row.avg_rating),
        updatedAt: row.updated_at
      }));
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cassandra/sync-all', async (req, res) => {
  if (!cassandraReady) {
    return res.status(503).json({ error: 'Cassandra nije dostupna' });
  }

  const session = driver.session();
  try {
    const playersResult = await session.run(`
      MATCH (p:Player)
      RETURN p.username as username
    `);
    
    const players = playersResult.records.map(r => r.get('username'));
    let synced = 0;
    
    for (const username of players) {
      const gamesResult = await session.run(`
        MATCH (p:Player {username: $username})-[r:RATED]->(g:Game)
        RETURN g.title as title, r.score as rating
      `, { username });
      
      const games = gamesResult.records.map(record => ({
        title: record.get('title'),
        rating: record.get('rating')
      }));
      
      const ratedGames = games.filter(g => g.rating !== null && g.rating !== undefined);
      const avgRating = ratedGames.length > 0 
        ? ratedGames.reduce((sum, g) => sum + g.rating, 0) / ratedGames.length 
        : 0;
      
      const globalQuery = `
        INSERT INTO global_leaderboard (username, total_score, games_played, avg_rating, updated_at)
        VALUES (?, ?, ?, ?, toTimestamp(now()))
      `;
      await cassandraClient.execute(globalQuery, [username, 0, ratedGames.length, avgRating], { prepare: true });
      
      for (const game of ratedGames) {
        const gameQuery = `
          INSERT INTO game_leaderboard (game_title, username, score, updated_at)
          VALUES (?, ?, ?, toTimestamp(now()))
        `;
        await cassandraClient.execute(gameQuery, [game.title, username, game.rating], { prepare: true });
      }
      
      synced++;
    }
    
    res.json({ message: `Successfully synced ${synced} players to Cassandra`, totalPlayers: synced });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

app.get('/api/stats/leaderboard-summary', async (req, res) => {
  const neoSession = driver.session();
  try {
    const ratingsCount = await neoSession.run('MATCH ()-[r:RATED]->() RETURN count(r) as count');
    const topicsCount = await neoSession.run('MATCH (t:Topic) RETURN count(t) as count');
    const commentsCount = await neoSession.run('MATCH (c:Comment) RETURN count(c) as count');
    const connectionsCount = await neoSession.run('MATCH ()-[f:FOLLOWS]->() RETURN count(f) as count');
    
    res.json({
      totalRatings: ratingsCount.records[0]?.get('count').toNumber() || 0,
      totalTopics: topicsCount.records[0]?.get('count').toNumber() || 0,
      totalComments: commentsCount.records[0]?.get('count').toNumber() || 0,
      totalConnections: connectionsCount.records[0]?.get('count').toNumber() || 0,
      totalTimeActive: 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await neoSession.close();
  }
});

app.post('/api/stats/activity', async (req, res) => {
  if (!cassandraReady) {
    return res.status(503).json({ error: 'Cassandra nije dostupna' });
  }
  
  try {
    const { username, activityType, points } = req.body;
    await addActivityPoints(username, activityType, points);
    res.json({ message: 'Activity logged successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/topics/recommended/:username', async (req, res) => {
  const session = driver.session();
  try {
    const { username } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get user's games
    const userGamesResult = await session.run(
      `MATCH (p:Player {username: $username})-[:RATED]->(g:Game)
       RETURN g.title as gameTitle`,
      { username }
    );
    
    const userGames = userGamesResult.records.map(r => r.get('gameTitle'));
    
    // Create keyword variations
    const gameKeywords = [];
    userGames.forEach(game => {
      const lowerGame = game.toLowerCase();
      gameKeywords.push(lowerGame);
      gameKeywords.push(lowerGame.replace(/\s+/g, '')); // Remove spaces
      gameKeywords.push(lowerGame.replace(/\s+/g, '-')); // Replace spaces with dash
      
      // Special aliases
      if (lowerGame.includes('counter strike')) {
        gameKeywords.push('cs2', 'counter-strike', 'counterstrike');
      }
      if (lowerGame.includes('league of legends')) {
        gameKeywords.push('lol', 'league');
      }
      if (lowerGame.includes('dota')) {
        gameKeywords.push('dota2', 'dota 2');
      }
      if (lowerGame.includes('call of duty')) {
        gameKeywords.push('cod', 'warzone');
      }
      if (lowerGame.includes('resident evil')) {
        gameKeywords.push('re4', 're');
      }
    });
    
    // Get users that current user follows
    const followingResult = await session.run(
      `MATCH (p:Player {username: $username})-[:FOLLOWS]->(followed:Player)
       RETURN followed.username as followedUsername`,
      { username }
    );
    
    const followedUsers = followingResult.records.map(r => r.get('followedUsername'));
    
    console.log('🎮 Game keywords:', gameKeywords);
    console.log('👥 Following:', followedUsers);
    
    // Build recommendation query
    const result = await session.run(
      `MATCH (t:Topic)
       OPTIONAL MATCH (c:Comment)-[:BELONGS_TO]->(t)
       WITH t, COUNT(c) as commentCount,
            toLower(t.title + ' ' + t.content) as searchText
       RETURN t, commentCount,
              CASE 
                WHEN ANY(keyword IN $gameKeywords WHERE searchText CONTAINS keyword) 
                THEN 2
                ELSE 0 
              END as gameMatch,
              CASE 
                WHEN t.authorUsername IN $followedUsers 
                THEN 1 
                ELSE 0 
              END as followingMatch
       ORDER BY (gameMatch + followingMatch) DESC, t.createdAt DESC
       SKIP ${skip} LIMIT ${parseInt(limit)}`,
      { 
        gameKeywords, 
        followedUsers
      }
    );
    
    const topics = result.records.map(record => {
      const topic = formatNeo4jDatetime(record.get('t').properties);
      topic.commentCount = record.get('commentCount').toNumber();
      const totalScore = record.get('gameMatch') + record.get('followingMatch');
      topic.isRecommended = totalScore > 0;
      
      console.log(`📝 Topic: "${topic.title.substring(0, 40)}..." | Score: ${totalScore}`);
      
      return topic;
    });
    
    // Count total
    const countResult = await session.run(`MATCH (t:Topic) RETURN count(t) as total`);
    const total = countResult.records[0].get('total').toNumber();
    
    console.log(`✅ Total recommended: ${topics.filter(t => t.isRecommended).length}/${topics.length}`);
    
    res.json({
      topics,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('❌ Error fetching recommended topics:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server pokrenut na http://localhost:${PORT}`);
});
