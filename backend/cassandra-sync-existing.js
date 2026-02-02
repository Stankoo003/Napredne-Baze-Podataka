const neo4j = require('neo4j-driver');
const cassandra = require('cassandra-driver');
require('dotenv').config();

const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password123'
  )
);

let cassandraClient = null;

async function connectCassandra() {
  cassandraClient = new cassandra.Client({
    contactPoints: [process.env.CASSANDRA_HOST || 'localhost'],
    localDataCenter: process.env.CASSANDRA_DATACENTER || 'datacenter1',
    keyspace: 'game_stats'
  });
  await cassandraClient.connect();
  console.log('✅ Cassandra connected');
}

async function syncAllPlayers() {
  const session = neo4jDriver.session();
  try {
    console.log('🔄 Fetching all players from Neo4j...');
    
    const playersResult = await session.run(`
      MATCH (p:Player)
      RETURN p.username as username
    `);
    
    const players = playersResult.records.map(r => r.get('username'));
    console.log(`📊 Found ${players.length} players in Neo4j`);
    
    for (const username of players) {
      console.log(`\n👤 Processing player: ${username}`);
      
      const gamesResult = await session.run(`
        MATCH (p:Player {username: $username})-[r:RATED]->(g:Game)
        RETURN g.title as title, r.score as rating
      `, { username });
      
      const games = gamesResult.records.map(record => ({
        title: record.get('title'),
        rating: record.get('rating')
      }));
      
      const ratedGames = games.filter(g => g.rating !== null && g.rating !== undefined);
      const totalScore = ratedGames.reduce((sum, g) => sum + (g.rating * 1000), 0);
      const avgRating = ratedGames.length > 0 
        ? ratedGames.reduce((sum, g) => sum + g.rating, 0) / ratedGames.length 
        : 0;
      
      const globalQuery = `
        INSERT INTO global_leaderboard (username, total_score, games_played, avg_rating, updated_at)
        VALUES (?, ?, ?, ?, toTimestamp(now()))
      `;
      await cassandraClient.execute(globalQuery, [username, totalScore, ratedGames.length, avgRating], { prepare: true });
      console.log(`  ✅ Global leaderboard: ${username} (score: ${totalScore}, games: ${ratedGames.length})`);
      
      for (const game of ratedGames) {
        const gameQuery = `
          INSERT INTO game_leaderboard (game_title, username, score, updated_at)
          VALUES (?, ?, ?, toTimestamp(now()))
        `;
        await cassandraClient.execute(gameQuery, [game.title, username, game.rating * 1000], { prepare: true });
        console.log(`  ✅ Game leaderboard: ${game.title} - score ${game.rating * 1000}`);
      }
    }
    
    console.log('\n🎉 Sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Sync error:', error);
  } finally {
    await session.close();
  }
}

async function main() {
  try {
    await connectCassandra();
    await syncAllPlayers();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await cassandraClient.shutdown();
    await neo4jDriver.close();
    console.log('\n👋 Disconnected');
  }
}

main();
