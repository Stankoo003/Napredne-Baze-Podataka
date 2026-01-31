const neo4j = require('neo4j-driver');
require('dotenv').config();

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password123'
  )
);

async function initData() {
  const session = driver.session();
  
  try {
    console.log('🔄 Brisanje postojećih podataka...');
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('✅ Baza očišćena');
    
    // IGRAČI
    console.log('🔄 Kreiranje igrača...');
    await session.run(`
        CREATE (p1:Player {username: 'marko', email: 'marko@test.com', age: 25, password: 'marko123', createdAt: datetime()})
        CREATE (p2:Player {username: 'ana', email: 'ana@test.com', age: 22, password: 'ana123', createdAt: datetime()})
        CREATE (p3:Player {username: 'stefan', email: 'stefan@test.com', age: 28, password: 'stefan123', createdAt: datetime()})
        CREATE (p4:Player {username: 'jelena', email: 'jelena@test.com', age: 24, password: 'jelena123', createdAt: datetime()})
        CREATE (p5:Player {username: 'nikola', email: 'nikola@test.com', age: 26, password: 'nikola123', createdAt: datetime()})
        CREATE (p6:Player {username: 'milica', email: 'milica@test.com', age: 23, password: 'milica123', createdAt: datetime()})
      `);
    console.log('✅ 6 igrača kreirano');
    
    // IGRE
    console.log('🔄 Kreiranje igara...');
    await session.run(`
      CREATE (g1:Game {title: 'Elden Ring', genre: 'Action RPG', releaseYear: 2022})
      CREATE (g2:Game {title: 'Resident Evil 4', genre: 'Horror', releaseYear: 2023})
      CREATE (g3:Game {title: 'Baldurs Gate 3', genre: 'RPG', releaseYear: 2023})
      CREATE (g4:Game {title: 'Cyberpunk 2077', genre: 'Action RPG', releaseYear: 2020})
      CREATE (g5:Game {title: 'Dark Souls 3', genre: 'Action RPG', releaseYear: 2016})
      CREATE (g6:Game {title: 'The Witcher 3', genre: 'RPG', releaseYear: 2015})
      CREATE (g7:Game {title: 'Sekiro', genre: 'Action', releaseYear: 2019})
      CREATE (g8:Game {title: 'Bloodborne', genre: 'Action RPG', releaseYear: 2015})
    `);
    console.log('✅ 8 igara kreirano');
    
    // FOLLOWS relacije
    console.log('🔄 Kreiranje FOLLOWS relacija...');
    await session.run(`
      MATCH (marko:Player {username: 'marko'})
      MATCH (ana:Player {username: 'ana'})
      MATCH (stefan:Player {username: 'stefan'})
      MATCH (jelena:Player {username: 'jelena'})
      MATCH (nikola:Player {username: 'nikola'})
      MATCH (milica:Player {username: 'milica'})
      
      CREATE (marko)-[:FOLLOWS]->(ana)
      CREATE (marko)-[:FOLLOWS]->(stefan)
      CREATE (marko)-[:FOLLOWS]->(jelena)
      CREATE (ana)-[:FOLLOWS]->(stefan)
      CREATE (ana)-[:FOLLOWS]->(nikola)
      CREATE (stefan)-[:FOLLOWS]->(jelena)
      CREATE (stefan)-[:FOLLOWS]->(milica)
      CREATE (jelena)-[:FOLLOWS]->(nikola)
      CREATE (nikola)-[:FOLLOWS]->(milica)
    `);
    console.log('✅ FOLLOWS relacije kreirane');
    
    // BLOCKS relacije
    console.log('🔄 Kreiranje BLOCKS relacija...');
    await session.run(`
      MATCH (marko:Player {username: 'marko'})
      MATCH (milica:Player {username: 'milica'})
      CREATE (marko)-[:BLOCKS]->(milica)
    `);
    console.log('✅ BLOCKS relacije kreirane');
    
    // RATED relacije (ocene)
    console.log('🔄 Kreiranje RATED relacija...');
    await session.run(`
      MATCH (marko:Player {username: 'marko'})
      MATCH (ana:Player {username: 'ana'})
      MATCH (stefan:Player {username: 'stefan'})
      MATCH (jelena:Player {username: 'jelena'})
      MATCH (nikola:Player {username: 'nikola'})
      
      MATCH (er:Game {title: 'Elden Ring'})
      MATCH (re4:Game {title: 'Resident Evil 4'})
      MATCH (bg3:Game {title: 'Baldurs Gate 3'})
      MATCH (cp:Game {title: 'Cyberpunk 2077'})
      MATCH (ds3:Game {title: 'Dark Souls 3'})
      MATCH (w3:Game {title: 'The Witcher 3'})
      MATCH (sek:Game {title: 'Sekiro'})
      MATCH (bb:Game {title: 'Bloodborne'})
      
      CREATE (marko)-[:RATED {score: 5, ratedAt: datetime()}]->(er)
      CREATE (marko)-[:RATED {score: 4, ratedAt: datetime()}]->(ds3)
      CREATE (marko)-[:RATED {score: 3, ratedAt: datetime()}]->(cp)
      
      CREATE (ana)-[:RATED {score: 5, ratedAt: datetime()}]->(er)
      CREATE (ana)-[:RATED {score: 5, ratedAt: datetime()}]->(bg3)
      CREATE (ana)-[:RATED {score: 4, ratedAt: datetime()}]->(w3)
      CREATE (ana)-[:RATED {score: 4, ratedAt: datetime()}]->(bb)
      
      CREATE (stefan)-[:RATED {score: 5, ratedAt: datetime()}]->(ds3)
      CREATE (stefan)-[:RATED {score: 4, ratedAt: datetime()}]->(bg3)
      CREATE (stefan)-[:RATED {score: 5, ratedAt: datetime()}]->(sek)
      
      CREATE (jelena)-[:RATED {score: 4, ratedAt: datetime()}]->(re4)
      CREATE (jelena)-[:RATED {score: 5, ratedAt: datetime()}]->(bg3)
      CREATE (jelena)-[:RATED {score: 3, ratedAt: datetime()}]->(cp)
      
      CREATE (nikola)-[:RATED {score: 5, ratedAt: datetime()}]->(w3)
      CREATE (nikola)-[:RATED {score: 4, ratedAt: datetime()}]->(cp)
      CREATE (nikola)-[:RATED {score: 5, ratedAt: datetime()}]->(bb)
    `);
    console.log('✅ RATED relacije kreirane');
    
    // FAVORITE relacije
    console.log('🔄 Kreiranje FAVORITE relacija...');
    await session.run(`
      MATCH (marko:Player {username: 'marko'})
      MATCH (ana:Player {username: 'ana'})
      MATCH (er:Game {title: 'Elden Ring'})
      MATCH (bg3:Game {title: 'Baldurs Gate 3'})
      
      CREATE (marko)-[:FAVORITE {addedAt: datetime()}]->(er)
      CREATE (ana)-[:FAVORITE {addedAt: datetime()}]->(bg3)
    `);
    console.log('✅ FAVORITE relacije kreirane');
    
    // Provera brojeva
    console.log('\n📊 STATISTIKA:');
    const playerCount = await session.run('MATCH (p:Player) RETURN count(p) as count');
    console.log(`   Igrači: ${playerCount.records[0].get('count').toNumber()}`);
    
    const gameCount = await session.run('MATCH (g:Game) RETURN count(g) as count');
    console.log(`   Igre: ${gameCount.records[0].get('count').toNumber()}`);
    
    const followsCount = await session.run('MATCH ()-[r:FOLLOWS]->() RETURN count(r) as count');
    console.log(`   FOLLOWS: ${followsCount.records[0].get('count').toNumber()}`);
    
    const ratedCount = await session.run('MATCH ()-[r:RATED]->() RETURN count(r) as count');
    console.log(`   RATED: ${ratedCount.records[0].get('count').toNumber()}`);
    
    const blocksCount = await session.run('MATCH ()-[r:BLOCKS]->() RETURN count(r) as count');
    console.log(`   BLOCKS: ${blocksCount.records[0].get('count').toNumber()}`);
    
    const favoriteCount = await session.run('MATCH ()-[r:FAVORITE]->() RETURN count(r) as count');
    console.log(`   FAVORITE: ${favoriteCount.records[0].get('count').toNumber()}`);
    
    console.log('\n🎉 Inicijalizacija uspešno završena!');
    
  } catch (error) {
    console.error('❌ Greška:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

initData();