const cassandra = require('cassandra-driver');

let client = null;

async function initCassandra() {
  const tempClient = new cassandra.Client({
    contactPoints: [process.env.CASSANDRA_HOST || 'localhost'],
    localDataCenter: process.env.CASSANDRA_DATACENTER || 'datacenter1',
  });

  try {
    await tempClient.connect();

    await tempClient.execute(`
      CREATE KEYSPACE IF NOT EXISTS game_stats
      WITH replication = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `);

    await tempClient.shutdown();

    client = new cassandra.Client({
      contactPoints: [process.env.CASSANDRA_HOST || 'localhost'],
      localDataCenter: process.env.CASSANDRA_DATACENTER || 'datacenter1',
      keyspace: 'game_stats',
    });

    await client.connect();

    await client.execute(`
      CREATE TABLE IF NOT EXISTS player_stats (
        username text,
        game_title text,
        total_playtime int,
        last_played timestamp,
        achievements_count int,
        level int,
        PRIMARY KEY (username, game_title)
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS game_leaderboard (
        game_title text,
        username text,
        score int,
        rank int,
        updated_at timestamp,
        PRIMARY KEY (game_title, score, username)
      ) WITH CLUSTERING ORDER BY (score DESC, username ASC)
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS global_leaderboard (
        username text PRIMARY KEY,
        total_score bigint,
        games_played int,
        avg_rating decimal,
        rank int,
        updated_at timestamp
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        date date,
        game_title text,
        total_players int,
        total_playtime int,
        PRIMARY KEY (date, game_title)
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS activity_log (
        username text,
        activity_type text,
        points decimal,
        timestamp timestamp,
        PRIMARY KEY (username, timestamp)
      ) WITH CLUSTERING ORDER BY (timestamp DESC)
    `);

    return client;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  initCassandra,
  getClient: () => client,
};
