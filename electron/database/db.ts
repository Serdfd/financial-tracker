import path from 'path'
import { app } from 'electron'
import fs from 'fs'

// Usar require para evitar que Vite lo bundlee
// eslint-disable-next-line @typescript-eslint/no-var-requires
const initSqlJs = require('sql.js')

let db: any

const getDbPath = () => path.join(app.getPath('userData'), 'financial-tracker.db')

export async function initDatabase(): Promise<any> {
  const wasmPath = path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')

  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  })

  const dbPath = getDbPath()

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  crearTablas()
  migraciones()
  insertarSemilla()
  guardarDb()

  return db
}

export function guardarDb() {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(getDbPath(), buffer)
}

export function getDb(): any {
  return db
}

function crearTablas() {
  db.run(`
    CREATE TABLE IF NOT EXISTS entidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT,
      activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tipos_inversion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS perfiles_riesgo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      descripcion TEXT,
      activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      emoji TEXT DEFAULT '',
      activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS monedas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      simbolo TEXT NOT NULL,
      tasa_a_cop REAL DEFAULT 1,
      activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS presupuesto_fijos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      categoria_id INTEGER REFERENCES categorias(id),
      monto REAL NOT NULL,
      activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS presupuesto_variables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      categoria_id INTEGER REFERENCES categorias(id),
      tope_mensual REAL NOT NULL,
      activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS meses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anio INTEGER NOT NULL,
      mes INTEGER NOT NULL,
      cerrado INTEGER DEFAULT 0,
      UNIQUE(anio, mes)
    );

    CREATE TABLE IF NOT EXISTS ingresos_mes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mes_id INTEGER NOT NULL REFERENCES meses(id),
      categoria_id INTEGER REFERENCES categorias(id),
      monto REAL NOT NULL,
      moneda_id INTEGER REFERENCES monedas(id),
      nota TEXT
    );

    CREATE TABLE IF NOT EXISTS gastos_mes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mes_id INTEGER NOT NULL REFERENCES meses(id),
      categoria_id INTEGER REFERENCES categorias(id),
      monto REAL NOT NULL,
      moneda_id INTEGER REFERENCES monedas(id),
      nota TEXT
    );

    CREATE TABLE IF NOT EXISTS deudas_tc (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mes_id INTEGER NOT NULL REFERENCES meses(id),
      nombre_tc TEXT NOT NULL,
      saldo REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inversiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      entidad_id INTEGER REFERENCES entidades(id),
      tipo_id INTEGER REFERENCES tipos_inversion(id),
      riesgo_id INTEGER REFERENCES perfiles_riesgo(id),
      moneda_id INTEGER REFERENCES monedas(id),
      estado TEXT DEFAULT 'activo',
      fecha_inicio TEXT,
      notas TEXT,
      activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS inversion_mensual (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inversion_id INTEGER NOT NULL REFERENCES inversiones(id),
      mes_id INTEGER NOT NULL REFERENCES meses(id),
      saldo_cierre REAL NOT NULL DEFAULT 0,
      aportes REAL DEFAULT 0,
      retiros REAL DEFAULT 0,
      rendimiento REAL DEFAULT 0,
      rentabilidad_pct REAL DEFAULT 0,
      UNIQUE(inversion_id, mes_id)
    );

    CREATE TABLE IF NOT EXISTS inmuebles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inversion_id INTEGER NOT NULL REFERENCES inversiones(id),
      precio_compra REAL NOT NULL,
      valor_estimado_actual REAL,
      cuota_mensual REAL,
      cuotas_totales INTEGER,
      cuotas_pagadas INTEGER DEFAULT 0,
      fecha_entrega_estimada TEXT,
      estado TEXT DEFAULT 'en_construccion'
    );

    CREATE TABLE IF NOT EXISTS fichas_inversion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inversion_id INTEGER NOT NULL UNIQUE REFERENCES inversiones(id),
      -- CDT
      tasa_ea REAL,
      fecha_vencimiento TEXT,
      plazo_dias INTEGER,
      monto_inicial REAL,
      -- Acciones
      num_acciones REAL,
      precio_promedio REAL,
      mercado TEXT,
      ticker TEXT,
      -- Crypto
      cantidad_tokens REAL,
      token_symbol TEXT,
      precio_promedio_crypto REAL
    );

    CREATE TABLE IF NOT EXISTS lotes_inversion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inversion_id INTEGER NOT NULL REFERENCES inversiones(id),
      fecha_compra TEXT NOT NULL,
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      comision REAL DEFAULT 0,
      nota TEXT
    );
  `)
}

// Migraciones para bases de datos existentes
function migraciones() {
  // Migración: agregar columna emoji a categorias si no existe
  const infoCat = db.exec("PRAGMA table_info(categorias)")
  if (infoCat.length) {
    const columnas = infoCat[0].values.map((row: any[]) => row[1])
    if (!columnas.includes('emoji')) {
      db.run("ALTER TABLE categorias ADD COLUMN emoji TEXT DEFAULT ''")
    }
  }

  // Migración: crear tabla fichas_inversion si no existe (ya está en crearTablas,
  // pero para DBs que ya existían antes de esta versión)
  db.run(`
    CREATE TABLE IF NOT EXISTS fichas_inversion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inversion_id INTEGER NOT NULL UNIQUE REFERENCES inversiones(id),
      tasa_ea REAL,
      fecha_vencimiento TEXT,
      plazo_dias INTEGER,
      monto_inicial REAL,
      num_acciones REAL,
      precio_promedio REAL,
      mercado TEXT,
      ticker TEXT,
      cantidad_tokens REAL,
      token_symbol TEXT,
      precio_promedio_crypto REAL
    )
  `)

  // Migración: crear tabla lotes_inversion
  db.run(`
    CREATE TABLE IF NOT EXISTS lotes_inversion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inversion_id INTEGER NOT NULL REFERENCES inversiones(id),
      fecha_compra TEXT NOT NULL,
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      comision REAL DEFAULT 0,
      nota TEXT
    )
  `)
}

function insertarSemilla() {
  const monedas = db.exec('SELECT COUNT(*) as cnt FROM monedas')
  const cnt = monedas[0]?.values[0][0] as number
  if (cnt > 0) return

  db.run(`
    INSERT INTO monedas (codigo, nombre, simbolo, tasa_a_cop) VALUES
      ('COP', 'Peso Colombiano', '$', 1),
      ('USD', 'Dólar Estadounidense', 'US$', 4200);

    INSERT INTO perfiles_riesgo (nombre, color, descripcion) VALUES
      ('Bajo', '#22c55e', 'Inversiones conservadoras con bajo riesgo'),
      ('Moderado', '#eab308', 'Inversiones con riesgo medio'),
      ('Alto', '#ef4444', 'Inversiones agresivas con alto riesgo');

    INSERT INTO tipos_inversion (nombre) VALUES
      ('CDT'),
      ('Cuenta Ahorro Alto Rendimiento'),
      ('FIC'),
      ('Acciones'),
      ('Crypto'),
      ('Inmueble');

    INSERT INTO categorias (nombre, tipo, color, emoji) VALUES
      ('Salario', 'ingreso', '#22c55e', '💰'),
      ('Bono', 'ingreso', '#10b981', '🎁'),
      ('Rendimientos', 'ingreso', '#06b6d4', '📈'),
      ('Arriendo', 'ingreso', '#3b82f6', '🏠'),
      ('Otros ingresos', 'ingreso', '#8b5cf6', '💵'),
      ('Vivienda', 'gasto', '#ef4444', '🏠'),
      ('Servicios', 'gasto', '#f97316', '💡'),
      ('Alimentación', 'gasto', '#eab308', '🛒'),
      ('Transporte', 'gasto', '#84cc16', '🚌'),
      ('Auto', 'gasto', '#14b8a6', '🚗'),
      ('Salud', 'gasto', '#06b6d4', '🏥'),
      ('Entretenimiento', 'gasto', '#8b5cf6', '🎬'),
      ('Ropa', 'gasto', '#ec4899', '👕'),
      ('Impuestos', 'gasto', '#f43f5e', '🏛️'),
      ('Otros gastos', 'gasto', '#94a3b8', '📦');
  `)
}