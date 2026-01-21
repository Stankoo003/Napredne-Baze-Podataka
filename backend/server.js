const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password123')
);

// API endpoint - Vrati sve nodove
app.get('/api/nodes', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n)
      RETURN n {.*, __typename: label(n)} LIMIT 25
    `);
    
    const nodes = result.records.map(record => record.get(0));
    res.json({ nodes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// Kreiraj nod
app.post('/api/nodes', async (req, res) => {
  const session = driver.session();
  try {
    const { label, properties } = req.body;
    const result = await session.run(
      `CREATE (n:${label} $props) RETURN n`,
      { props: properties }
    );
    res.json(result.records[0].get(0));
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

app.listen(3001, () => {
  console.log('🚀 Backend radi na http://localhost:3001');
});
