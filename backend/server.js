const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Helper funkcija za formatiranje Neo4j datetime
function formatNeo4jDatetime(obj) {
  if (!obj) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => formatNeo4jDatetime(item));
  }
  
  if (typeof obj === 'object') {
    const formatted = {};
    for (const [key, value] of Object.entries(obj)) {
      // Ako je Neo4j datetime objekat
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


// Neo4j Driver
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j', 
    process.env.NEO4J_PASSWORD || 'password123'
  )
);

// Test konekcija
driver.getServerInfo()
  .then(info => {
    console.log('✅ Neo4j povezan:', info.address);
  })
  .catch(err => {
    console.error('❌ Neo4j greška:', err);
  });

// ==================== PLAYER ENDPOINTS ====================

// Kreiraj igrača (SIGNUP)
app.post('/api/players', async (req, res) => {
  const session = driver.session();
  try {
    const { username, email, age, password } = req.body;
    
    // Validacija input-a
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email i password su obavezni' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username mora imati minimum 3 karaktera' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password mora imati minimum 6 karaktera' });
    }
    
    // Email regex validacija
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Neispravan email format' });
    }
    
    // Proveri da li username već postoji
    const existingUser = await session.run(
      `MATCH (p:Player {username: $username}) RETURN p`,
      { username }
    );
    
    if (existingUser.records.length > 0) {
      return res.status(409).json({ error: 'Username već postoji' });
    }
    
    // Proveri da li email već postoji
    const existingEmail = await session.run(
      `MATCH (p:Player {email: $email}) RETURN p`,
      { email }
    );
    
    if (existingEmail.records.length > 0) {
      return res.status(409).json({ error: 'Email već postoji' });
    }
    
    // Kreiraj novog igrača
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
    
    // Ne vraćaj password u response-u
    delete player.password;
    
    // Formatiraj datetime
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

// LOGIN endpoint
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
    delete player.password; // Ne šalji password nazad
    
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



// Vrati sve igrače
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


// Vrati jednog igrača po username
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

// Vrati kompletan profil igrača sa statistikom
app.get('/api/players/:username/profile', async (req, res) => {
  const session = driver.session();
  try {
    const { username } = req.params;
    
    // Osnovni podaci o igraču
    const playerResult = await session.run(
      `MATCH (p:Player {username: $username}) RETURN p`,
      { username }
    );
    
    if (playerResult.records.length === 0) {
      return res.status(404).json({ error: 'Igrač ne postoji' });
    }
    
    const player = playerResult.records[0].get('p').properties;
    delete player.password; // Ne šalji password
    
    if (player.createdAt) {
      player.createdAt = player.createdAt.toString();
    }
    
    // Statistika - broj prijatelja (FOLLOWS)
    const followsResult = await session.run(
      `MATCH (p:Player {username: $username})-[:FOLLOWS]->(friend)
       RETURN COUNT(friend) AS followsCount`,
      { username }
    );
    const followsCount = followsResult.records[0].get('followsCount').toNumber();
    
    // Statistika - broj followera
    const followersResult = await session.run(
      `MATCH (follower)-[:FOLLOWS]->(p:Player {username: $username})
       RETURN COUNT(follower) AS followersCount`,
      { username }
    );
    const followersCount = followersResult.records[0].get('followersCount').toNumber();
    
    // Statistika - broj blokiranih
    const blocksResult = await session.run(
      `MATCH (p:Player {username: $username})-[:BLOCKS]->(blocked)
       RETURN COUNT(blocked) AS blocksCount`,
      { username }
    );
    const blocksCount = blocksResult.records[0].get('blocksCount').toNumber();
    
    // Statistika - broj ocenjenih igara
    const ratedGamesResult = await session.run(
      `MATCH (p:Player {username: $username})-[r:RATED]->(g:Game)
       RETURN COUNT(g) AS ratedCount, AVG(r.score) AS avgRating`,
      { username }
    );
    const ratedCount = ratedGamesResult.records[0].get('ratedCount').toNumber();
    const avgRating = ratedGamesResult.records[0].get('avgRating') || 0;
    
    // Favorite games
    const favoritesResult = await session.run(
      `MATCH (p:Player {username: $username})-[:FAVORITE]->(g:Game)
       RETURN g.title AS title, g.genre AS genre
       ORDER BY g.title
       LIMIT 10`,
      { username }
    );
    const favoriteGames = favoritesResult.records.map(record => ({
      title: record.get('title'),
      genre: record.get('genre')
    }));
    
    // Top rated games
    const topRatedResult = await session.run(
      `MATCH (p:Player {username: $username})-[r:RATED]->(g:Game)
       WHERE r.score >= 4
       RETURN g.title AS title, g.genre AS genre, r.score AS rating
       ORDER BY r.score DESC, g.title
       LIMIT 10`,
      { username }
    );
    const topRatedGames = topRatedResult.records.map(record => ({
      title: record.get('title'),
      genre: record.get('genre'),
      rating: record.get('rating')
    }));
    
    // Lista prijatelja
    const friendsListResult = await session.run(
      `MATCH (p:Player {username: $username})-[:FOLLOWS]->(friend:Player)
       RETURN friend.username AS username, friend.email AS email
       ORDER BY friend.username
       LIMIT 20`,
      { username }
    );
    const friendsList = friendsListResult.records.map(record => ({
      username: record.get('username'),
      email: record.get('email')
    }));
    
    // Vrati sve podatke
    res.json({
      player: player,
      stats: {
        followsCount: followsCount,
        followersCount: followersCount,
        blocksCount: blocksCount,
        ratedGamesCount: ratedCount,
        averageRating: avgRating ? avgRating.toFixed(1) : '0.0'
      },
      favoriteGames: favoriteGames,
      topRatedGames: topRatedGames,
      friendsList: friendsList
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});



// ==================== GAME ENDPOINTS ====================

// Kreiraj igru
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

// Vrati sve igre
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

// ==================== RELATIONSHIP ENDPOINTS ====================

// Prati igrača (FOLLOWS)
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

// Blokiraj igrača (BLOCKS)
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

// Oceni igru (RATED)
app.post('/api/players/:username/rate', async (req, res) => {
  const session = driver.session();
  try {
    const { username } = req.params;
    const { gameTitle, rating } = req.body; // rating: 1-5
    
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

// Dodaj u favorite (FAVORITE)
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

// ==================== RECOMMENDATION ENDPOINTS ====================

// Preporuke na osnovu prijatelja (friends' favorites)
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

// Preporuke na osnovu prijatelja prijatelja (friends of friends)
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

// Preporuke na osnovu sličnog ukusa (similar taste)
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

// ==================== SOCIAL GRAPH ENDPOINT (SVE KONEKCIJE ZA IGRU) ====================
app.post('/api/social-graph', async (req, res) => {
  const session = driver.session();
  try {
    const { username, gameTitle } = req.body;

    // Pronađi SVE igrače koji su ocenili ovu igru (osim trenutnog korisnika)
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

    // Ako nema drugih igrača, vrati prazno
    if (players.length === 0) {
      return res.json({ players: [], connections: [] });
    }

    // Pronađi SVE FOLLOWS veze između ovih igrača (uključujući trenutnog korisnika)
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


// Vrati socijalnu mrežu igrača
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend radi na http://localhost:${PORT}`);
});

// Cleanup na zatvaranje
process.on('SIGINT', async () => {
  await driver.close();
  process.exit(0);
});