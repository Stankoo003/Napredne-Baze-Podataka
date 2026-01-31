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

// Kreiraj igrača
app.post('/api/players', async (req, res) => {
  const session = driver.session();
  try {
    const { username, email, age } = req.body;
    
    // Proveri da li username već postoji
    const existingPlayer = await session.run(
      `MATCH (p:Player {username: $username}) RETURN p`,
      { username }
    );
    
    if (existingPlayer.records.length > 0) {
      return res.status(409).json({ error: 'Username već postoji' });
    }
    
    const result = await session.run(
      `CREATE (p:Player {username: $username, email: $email, age: $age, createdAt: datetime()})
       RETURN p`,
      { username, email, age }
    );
    
    const player = result.records[0].get('p').properties;
    
    // Formatiraj datetime u string
    if (player.createdAt) {
      player.createdAt = player.createdAt.toString();
    }
    
    res.json(player);
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
