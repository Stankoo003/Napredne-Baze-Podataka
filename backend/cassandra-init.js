const cassandra = require('cassandra-driver');

let client = null;

async function initCassandra() {
  const tempClient = new cassandra.Client({
    contactPoints: [process.env.CASSANDRA_HOST || 'localhost'],
    localDataCenter: process.env.CASSANDRA_DATACENTER || 'datacenter1'
  });

  try {
    await tempClient.connect();
    console.log('📡 Povezan sa Cassandra...');

    // Kreiraj keyspace
    await tempClient.execute(`
      CREATE KEYSPACE IF NOT EXISTS game_stats
      WITH replication = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `);
    console.log('✅ Keyspace game_stats kreiran');

    await tempClient.shutdown();

    // Konektuj se na keyspace
    client = new cassandra.Client({
      contactPoints: [process.env.CASSANDRA_HOST || 'localhost'],
      localDataCenter: process.env.CASSANDRA_DATACENTER || 'datacenter1',
      keyspace: 'game_stats'
    });

    await client.connect();

    // Tabela za player statistiku
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
    console.log('✅ Tabela player_stats kreirana');

    // Tabela za game leaderboard
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
    console.log('✅ Tabela game_leaderboard kreirana');

    // Tabela za global leaderboard
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
    console.log('✅ Tabela global_leaderboard kreirana');

    // Tabela za daily statistics
    await client.execute(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        date date,
        game_title text,
        total_players int,
        total_playtime int,
        PRIMARY KEY (date, game_title)
      )
    `);
    console.log('✅ Tabela daily_stats kreirana');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS activity_log (
        username text,
        activity_type text,
        points decimal,
        timestamp timestamp,
        PRIMARY KEY (username, timestamp)
      ) WITH CLUSTERING ORDER BY (timestamp DESC)
    `);
    console.log('✅ Tabela activity_log kreirana');
    

    console.log('🎉 Cassandra inicijalizacija završena!');
    return client;
  } catch (error) {
    console.error('❌ Cassandra greška:', error);
    throw error;
  }
}

module.exports = { initCassandra, getClient: () => client };
