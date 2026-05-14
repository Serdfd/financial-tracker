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
      -- General
      precio_compra_total REAL NOT NULL,
      valor_estimado_actual REAL,
      estado TEXT DEFAULT 'en_construccion',
      fecha_entrega_estimada TEXT,
      -- Etapa 1: Separación
      monto_separacion REAL DEFAULT 0,
      -- Etapa 2: Cuota inicial
      cuota_inicial_total REAL DEFAULT 0,
      cuota_inicial_num_cuotas INTEGER DEFAULT 0,
      cuota_inicial_valor_cuota REAL DEFAULT 0,
      cuota_inicial_cuotas_pagadas INTEGER DEFAULT 0,
      -- Etapa 3: Financiación
      financiacion_entidad_id INTEGER REFERENCES entidades(id),
      financiacion_monto REAL DEFAULT 0,
      financiacion_plazo_meses INTEGER DEFAULT 0,
      financiacion_valor_cuota REAL DEFAULT 0,
      financiacion_cuotas_pagadas INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pagos_inmueble (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inmueble_id INTEGER NOT NULL REFERENCES inmuebles(id),
      fecha TEXT NOT NULL,
      monto REAL NOT NULL,
      etapa TEXT NOT NULL CHECK(etapa IN ('separacion', 'cuota_inicial', 'financiacion')),
      nota TEXT
    );

    CREATE TABLE IF NOT EXISTS fichas_inversion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inversion_id INTEGER NOT NULL UNIQUE REFERENCES inversiones(id),
      -- CDT
      tasa_ea REAL,
      fecha_vencimiento TEXT,
      plazo_dias INTEGER,
      monto_inicial REAL,
      retencion_pct REAL DEFAULT 4,
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

    CREATE TABLE IF NOT EXISTS parametros_globales (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      descripcion TEXT
    );



    INSERT OR IGNORE INTO parametros_globales (clave, valor, descripcion) VALUES
      ('smlv', '1300000', 'Salario Mínimo Legal Vigente en COP'),
      ('retencion_cdt', '4', 'Retención en la fuente para CDTs (%)');
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

  // Migración: agregar retencion_pct a fichas_inversion
  const infoFicha = db.exec("PRAGMA table_info(fichas_inversion)")
  if (infoFicha.length) {
    const columnasFicha = infoFicha[0].values.map((row: any[]) => row[1])
    if (!columnasFicha.includes('retencion_pct')) {
      db.run("ALTER TABLE fichas_inversion ADD COLUMN retencion_pct REAL DEFAULT 4")
    }
  }

  // Migración: reestructurar tabla inmuebles con las 3 etapas
  const infoInmueble = db.exec("PRAGMA table_info(inmuebles)")
  if (infoInmueble.length) {
    const columnasInmueble = infoInmueble[0].values.map((row: any[]) => row[1])

    // Primero agregar precio_compra_total si no existe
    if (!columnasInmueble.includes('precio_compra_total')) {
      db.run("ALTER TABLE inmuebles ADD COLUMN precio_compra_total REAL DEFAULT 0")
      // Copiar datos del campo viejo si existe
      if (columnasInmueble.includes('precio_compra')) {
        db.run("UPDATE inmuebles SET precio_compra_total = precio_compra")
      }
    }

    // Luego agregar el resto de columnas nuevas
    if (!columnasInmueble.includes('monto_separacion')) {
      db.run("ALTER TABLE inmuebles ADD COLUMN monto_separacion REAL DEFAULT 0")
      db.run("ALTER TABLE inmuebles ADD COLUMN cuota_inicial_total REAL DEFAULT 0")
      db.run("ALTER TABLE inmuebles ADD COLUMN cuota_inicial_num_cuotas INTEGER DEFAULT 0")
      db.run("ALTER TABLE inmuebles ADD COLUMN cuota_inicial_valor_cuota REAL DEFAULT 0")
      db.run("ALTER TABLE inmuebles ADD COLUMN cuota_inicial_cuotas_pagadas INTEGER DEFAULT 0")
      db.run("ALTER TABLE inmuebles ADD COLUMN financiacion_entidad_id INTEGER")
      db.run("ALTER TABLE inmuebles ADD COLUMN financiacion_monto REAL DEFAULT 0")
      db.run("ALTER TABLE inmuebles ADD COLUMN financiacion_plazo_meses INTEGER DEFAULT 0")
      db.run("ALTER TABLE inmuebles ADD COLUMN financiacion_valor_cuota REAL DEFAULT 0")
      db.run("ALTER TABLE inmuebles ADD COLUMN financiacion_cuotas_pagadas INTEGER DEFAULT 0")
    }
  }

  // Migración: tabla parametros_globales
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS parametros_globales (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      descripcion TEXT
    )`)
    db.run(`INSERT OR IGNORE INTO parametros_globales (clave, valor, descripcion) VALUES
      ('smlv', '1300000', 'Salario Mínimo Legal Vigente en COP'),
      ('retencion_cdt', '4', 'Retención en la fuente para CDTs (%)')`)
  } catch {}

  // Migración: columnas VIS en inmuebles
  const infoInm2 = db.exec("PRAGMA table_info(inmuebles)")
  if (infoInm2.length) {
    const cols = infoInm2[0].values.map((r: any[]) => r[1])
    if (!cols.includes('tipo_precio')) {
      db.run("ALTER TABLE inmuebles ADD COLUMN tipo_precio TEXT DEFAULT 'fijo'")
      db.run("ALTER TABLE inmuebles ADD COLUMN smlv_pactados REAL DEFAULT 0")
    }
  }

  // Migración: tabla pagos_inmueble
  db.run(`
    CREATE TABLE IF NOT EXISTS pagos_inmueble (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inmueble_id INTEGER NOT NULL REFERENCES inmuebles(id),
      fecha TEXT NOT NULL,
      monto REAL NOT NULL,
      etapa TEXT NOT NULL CHECK(etapa IN ('separacion', 'cuota_inicial', 'financiacion')),
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