import { Pool, PoolConfig } from 'pg';

let credentials;
/* PG Database Credentials */
const dbUsername = 'openTransport'
const dbPassword = 'op3ntranzp0rt'

/**
 * Provides different database credentials to PG connection based
 * on current node environment. 
 */
switch (process.env.NODE_ENV) {
  case 'test':
    // Connects to local test DB
    credentials = {
      host: 'localhost',
      port: 5432,
      user: dbUsername,
      password: dbPassword,
      database: 'Test'
    }
    break;
  case 'development':
    // Connects to local dev DB
    credentials = {
      host: 'localhost',
      port: 5432,
      user: dbUsername,
      password: dbPassword,
      database: 'FYP'
    }
    break;
  case 'production':
    // Connects to live DB
    credentials = {
      host: '176.9.4.188',
      port: 5432,
      user: dbUsername,
      password: dbPassword,
      database: 'FYP'
    }
    break;
}

/**
 * Sets up Pool connections to PG database.
 * Database used is dependent on current node environment.
 */
class Database {
  readonly pool: Pool;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
  }

  /**
   * Runs query on pool of connections.
   * Pooling allows for a multitude of open connections
   * improving performance and allowing for parallel processing 
   * of requests.
   */
  query = async (command: string): Promise<Array<any>> => {
    return (await this.pool.query(command)).rows;
  }

  /**
   * Disconnects from database.
   */
  disconnect = () => {
    this.pool.end();
  }
}

export const ot_database: Database = new Database(credentials);