// lib/ebay/client.ts

/**
 * Client API eBay
 * 
 * Utilise l'API REST eBay (Inventory API + Fulfillment API)
 * Documentation: https://developer.ebay.com/api-docs
 */

import { EbayConfig, EbayToken } from './types'

// URLs de base selon l'environnement
const EBAY_API_URLS = {
  sandbox: {
    auth: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    api: 'https://api.sandbox.ebay.com',
  },
  production: {
    auth: 'https://api.ebay.com/identity/v1/oauth2/token',
    api: 'https://api.ebay.com',
  },
}

// Scopes nécessaires pour notre utilisation
const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
].join(' ')

// Cache du token (simple, en mémoire)
let cachedToken: EbayToken | null = null

/**
 * Récupère la configuration eBay depuis les variables d'environnement
 */
export function getEbayConfig(): EbayConfig {
  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET
  const devId = process.env.EBAY_DEV_ID
  const environment = (process.env.EBAY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'

  if (!clientId || !clientSecret || !devId) {
    throw new Error('Configuration eBay manquante. Vérifiez EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_DEV_ID dans .env.local')
  }

  return {
    clientId,
    clientSecret,
    devId,
    environment,
  }
}

/**
 * Obtient un token d'accès OAuth2 (Client Credentials Flow)
 */
export async function getAccessToken(): Promise<string> {
  // Vérifier le cache
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.accessToken
  }

  const config = getEbayConfig()
  const urls = EBAY_API_URLS[config.environment]

  // Encoder les credentials en Base64
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

  const response = await fetch(urls.auth, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(process.env.EBAY_REFRESH_TOKEN!)}&scope=${encodeURIComponent(EBAY_SCOPES)}`,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Erreur auth eBay:', errorText)
    throw new Error(`Erreur authentification eBay: ${response.status}`)
  }

  const data = await response.json()

  // Mettre en cache
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    tokenType: data.token_type,
  }

  console.log('✅ Token eBay obtenu, expire dans', data.expires_in, 'secondes')

  return cachedToken.accessToken
}

/**
 * Effectue un appel API eBay authentifié
 */
export async function ebayApiCall<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: any
    headers?: Record<string, string>
  } = {}
): Promise<T> {
  const config = getEbayConfig()
  const urls = EBAY_API_URLS[config.environment]
  const accessToken = await getAccessToken()

  const { method = 'GET', body, headers = {} } = options

  const url = `${urls.api}${endpoint}`
  
  console.log(`📡 eBay API: ${method} ${endpoint}`)

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
      'Accept': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const responseText = await response.text()
  
  let responseData: any
  try {
    responseData = responseText ? JSON.parse(responseText) : {}
  } catch {
    responseData = { rawResponse: responseText }
  }

  if (!response.ok) {
    console.error('❌ Erreur eBay API:', response.status, responseData)
    throw new Error(
      responseData?.errors?.[0]?.message || 
      responseData?.error_description || 
      `Erreur eBay API: ${response.status}`
    )
  }

  return responseData as T
}

/**
 * Vérifie si l'intégration eBay est configurée
 */
export function isEbayConfigured(): boolean {
  try {
    getEbayConfig()
    return true
  } catch {
    return false
  }
}

/**
 * Convertit EUR en USD (taux approximatif, à améliorer avec une API de taux)
 */
export function convertEURtoUSD(eurAmount: number): number {
  // Taux approximatif - idéalement utiliser une API de taux de change
  const EUR_TO_USD_RATE = 1.08
  return Math.round(eurAmount * EUR_TO_USD_RATE * 100) / 100
}

/**
 * Applique la majoration de 10% pour eBay
 */
export function calculateEbayPrice(prixBoutique: number): number {
  const prixMajore = prixBoutique * 1.10 // +10%
  const prixUSD = convertEURtoUSD(prixMajore)
  // Arrondir à .99 pour le marketing
  return Math.floor(prixUSD) + 0.99
}