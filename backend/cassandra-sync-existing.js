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
    keyspace: 'game_stats',
  });

  await cassandraClient.connect();
}

async function syncAllPlayers() {
  const session = neo4jDriver.session();

  try {
    const playersResult = await session.run(`
      MATCH (p:Player)
      RETURN p.username AS username
    `);

    const players = playersResult.records.map((r) => r.get('username'));

    for (const username of players) {
      const gamesResult = await session.run(
        `
        MATCH (p:Player {username: $username})-[r:RATED]->(g:Game)
        RETURN g.title AS title, r.score AS rating
        `,
        { username }
      );

      const games = gamesResult.records.map((record) => ({
        title: record.get('title'),
        rating: Number(record.get('rating')),
      }));

      const ratedGames = games.filter(
        (g) => g.rating !== null && g.rating !== undefined
      );

      const totalScore = ratedGames.reduce(
        (sum, g) => sum + g.rating * 1000,
        0
      );

      const avgRating =
        ratedGames.length > 0
          ? ratedGames.reduce((sum, g) => sum + g.rating, 0) /
            ratedGames.length
          : 0;

      const globalQuery = `
        INSERT INTO global_leaderboard (username, total_score, games_played, avg_rating, updated_at)
        VALUES (?, ?, ?, ?, toTimestamp(now()))
      `;

      await cassandraClient.execute(
        globalQuery,
        [username, totalScore, ratedGames.length, avgRating],
        { prepare: true }
      );

      for (const game of ratedGames) {
        const gameQuery = `
          INSERT INTO game_leaderboard (game_title, username, score, updated_at)
          VALUES (?, ?, ?, toTimestamp(now()))
        `;

        await cassandraClient.execute(
          gameQuery,
          [game.title, username, game.rating * 1000],
          { prepare: true }
        );
      }
    }
  } catch (error) {
    throw error;
  } finally {
    await session.close();
  }
}

async function main() {
  try {
    await connectCassandra();
    await syncAllPlayers();
  } finally {
    await cassandraClient.shutdown();
    await neo4jDriver.close();
  }
}

main();
