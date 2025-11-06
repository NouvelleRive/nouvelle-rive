// src/lib/square/client.ts
import { Client, Environment } from 'square'

const token = process.env.SQUARE_ACCESS_TOKEN
if (!token) throw new Error('SQUARE_ACCESS_TOKEN manquant')

const env =
  (process.env.SQUARE_ENV || 'production').toLowerCase() === 'sandbox'
    ? Environment.Sandbox
    : Environment.Production

export const squareClient = new Client({ accessToken: token, environment: env })
