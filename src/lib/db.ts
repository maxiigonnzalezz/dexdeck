
import Database from '@tauri-apps/plugin-sql';

export type Game = {
  id: number;
  name: string;
  developer: string;
  version: string;
  type: string;
  color: string;
  symbol: string;
  status: string;
  description: string;
  cover: string;
  official_url: string;
  install_path: string;
  executable_path: string;
};

export type GameInput = Omit<Game, 'id'>;

let databasePromise: Promise<Database> | undefined;

async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load('sqlite:dexdeck.db').catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

export async function listGames(): Promise<Game[]> {
  const db = await getDatabase();

  return db.select<Game[]>(
    `SELECT
      id,
      name,
      developer,
      version,
      type,
      color,
      symbol,
      status,
      description,
      cover,
      official_url,
      install_path,
      executable_path
    FROM games
    ORDER BY id DESC`
  );
}

export async function insertGame(game: GameInput): Promise<void> {
  const db = await getDatabase();

  await db.execute(
    `INSERT INTO games (
      name,
      developer,
      version,
      type,
      color,
      symbol,
      status,
      description,
      cover,
      official_url,
      install_path,
      executable_path
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    )`,
    [
      game.name,
      game.developer,
      game.version,
      game.type,
      game.color,
      game.symbol,
      game.status,
      game.description,
      game.cover,
      game.official_url,
      game.install_path,
      game.executable_path
    ]
  );
}

export async function updateGame(
  id: number,
  game: GameInput
): Promise<void> {
  const db = await getDatabase();

  await db.execute(
    `UPDATE games SET
      name = $1,
      developer = $2,
      version = $3,
      type = $4,
      color = $5,
      symbol = $6,
      status = $7,
      description = $8,
      cover = $9,
      official_url = $10,
      install_path = $11,
      executable_path = $12
    WHERE id = $13`,
    [
      game.name,
      game.developer,
      game.version,
      game.type,
      game.color,
      game.symbol,
      game.status,
      game.description,
      game.cover,
      game.official_url,
      game.install_path,
      game.executable_path,
      id
    ]
  );
}
