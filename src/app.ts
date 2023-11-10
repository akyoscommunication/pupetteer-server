import fastify, { FastifyInstance } from 'fastify'
import * as cheerio from 'cheerio'
import axios, { AxiosError, AxiosResponse } from 'axios'
import https from 'https'
import formBody from '@fastify/formbody'
import bearerAuthPlugin from '@fastify/bearer-auth'
import { BrowserLaunchArgumentOptions, Page } from 'puppeteer'
import { hcPages } from '@uyamazak/fastify-hc-pages'
import { hcPDFOptionsPlugin } from './plugins/pdf-options'
import { AppConfig, GetQuerystring, PostBody } from './types/hc-pdf-server'
import {
  ACCEPT_LANGUAGE,
  BEARER_AUTH_SECRET_KEY,
  BROWSER_LAUNCH_ARGS,
  DEFAULT_PRESET_PDF_OPTIONS_NAME,
  DEFAULT_VIEWPORT,
  EMULATE_MEDIA_TYPE_SCREEN_ENABLED,
  FASTIFY_BODY_LIMIT,
  FASTIFY_LOG_LEVEL,
  PAGE_TIMEOUT_MILLISECONDS,
  PAGES_NUM,
  PRESET_PDF_OPTIONS_FILE_PATH,
  USER_AGENT,
} from './config'

const getSchema = {
  querystring: {
    url: { type: 'string' },
    pdf_option: { type: ['null', 'string'] },
    header: { type: ['null', 'string'] },
    footer: { type: ['null', 'string'] },
  },
}

const postSchema = {
  body: {
    html: { type: 'string' },
    pdf_option: { type: ['null', 'string'] },
    header: { type: ['null', 'string'] },
    footer: { type: ['null', 'string'] },
  },
}

const createPDFHttpHeader = (buffer: Buffer) => ({
  'Content-Type': 'application/pdf',
  'Content-Length': buffer.length,
  // prevent cache
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: 0,
})

const defaultAppConfig: AppConfig = {
  presetPdfOptionsFilePath: PRESET_PDF_OPTIONS_FILE_PATH,
  defaultPresetPdfOptionsName: DEFAULT_PRESET_PDF_OPTIONS_NAME,
  bearerAuthSecretKey: BEARER_AUTH_SECRET_KEY,
  pagesNum: PAGES_NUM,
  userAgent: USER_AGENT,
  pageTimeoutMilliseconds: PAGE_TIMEOUT_MILLISECONDS,
  emulateMediaTypeScreenEnabled: EMULATE_MEDIA_TYPE_SCREEN_ENABLED,
  acceptLanguage: ACCEPT_LANGUAGE,
  fastifyLogLevel: FASTIFY_LOG_LEVEL,
  fastifyBodyLimit: FASTIFY_BODY_LIMIT,
  viewport: DEFAULT_VIEWPORT,
}

const buildBrowserLaunchArgs = (): BrowserLaunchArgumentOptions => {
  return {
    args: BROWSER_LAUNCH_ARGS.trim().split(','),
  }
}

export const app = async (
  appConfig = {} as Partial<AppConfig>
): Promise<FastifyInstance> => {
  const {
    presetPdfOptionsFilePath,
    defaultPresetPdfOptionsName,
    bearerAuthSecretKey,
    pagesNum,
    userAgent,
    pageTimeoutMilliseconds,
    emulateMediaTypeScreenEnabled,
    acceptLanguage,
    fastifyLogLevel,
    fastifyBodyLimit,
    viewport,
  } = { ...defaultAppConfig, ...appConfig }

  const server = fastify({
    logger: { level: fastifyLogLevel },
    bodyLimit: fastifyBodyLimit,
  })
  server.register(hcPDFOptionsPlugin, {
    filePath: presetPdfOptionsFilePath,
  })
  server.register(formBody)
  const pageOptions = {
    userAgent,
    pageTimeoutMilliseconds,
    emulateMediaTypeScreenEnabled,
    acceptLanguage,
    viewport,
  }
  const launchOptions = buildBrowserLaunchArgs()
  server.register(hcPages, {
    pagesNum,
    pageOptions,
    launchOptions,
  })

  if (bearerAuthSecretKey) {
    const keys = new Set([bearerAuthSecretKey])
    server.register(bearerAuthPlugin, { keys })
  }

  server.get<{
    Querystring: GetQuerystring
  }>('/', { schema: getSchema }, async (request, reply) => {
    const { url } = request.query
    if (!url) {
      reply.code(400).send({ error: 'url is required' })
      return
    }

    const pdfOptionsQuery =
      request.query.pdf_option ?? defaultPresetPdfOptionsName
    try {
      const buffer = await server.runOnPage<Buffer>(async (page: Page) => {
        await page.goto(url)
        const pdfOptions = server.getPDFOptions(pdfOptionsQuery)

        const header = request.query.header ?? false
        const footer = request.query.footer ?? false

        if (header) {
          pdfOptions.displayHeaderFooter = true

          const $ = cheerio.load(header)
          const imgElement = $('img')

          if (imgElement.length > 0) {
            const imgUrl = imgElement.attr('src')
            if (imgUrl !== undefined) {
              const imgBase64 = await getImageBase64(imgUrl)
              imgElement.attr('src', `data:image/png;base64,${imgBase64}`)
            }
          }
          pdfOptions.headerTemplate = $.html()
        }

        if (footer) {
          pdfOptions.displayHeaderFooter = true

          const $ = cheerio.load(footer)
          const imgElement = $('img')

          if (imgElement.length > 0) {
            const imgUrl = imgElement.attr('src')
            if (imgUrl !== undefined) {
              const imgBase64 = await getImageBase64(imgUrl)
              imgElement.attr('src', `data:image/png;base64,${imgBase64}`)
            }
          }
          pdfOptions.footerTemplate = $.html()
        }

        return await page.pdf(pdfOptions)
      })
      reply.headers(createPDFHttpHeader(buffer))
      reply.send(buffer)
    } catch (error) {
      console.error(`error ${error}`)
      reply.code(500).send({ error, url })
      return
    }
  })

  server.post<{
    Body: PostBody
  }>('/', { schema: postSchema }, async (request, reply) => {
    const body = request.body ?? null
    if (!body) {
      reply.code(400).send({ error: 'request body is empty' })
      return
    }
    const html = body.html ?? ''
    const header = body.header ?? false
    const footer = body.footer ?? false
    if (!html) {
      reply.code(400).send({ error: 'html is required' })
      return
    }
    const pdfOptionsQuery = body.pdf_option ?? defaultPresetPdfOptionsName
    const pdfOptions = server.getPDFOptions(pdfOptionsQuery)

    if (header) {
      pdfOptions.displayHeaderFooter = true
      pdfOptions.headerTemplate = header
    }

    if (footer) {
      pdfOptions.displayHeaderFooter = true
      pdfOptions.footerTemplate = footer
    }

    try {
      const buffer = await server.runOnPage<Buffer>(async (page: Page) => {
        await page.setContent(html, { waitUntil: ['domcontentloaded'] })
        return await page.pdf(pdfOptions)
      })
      reply.headers(createPDFHttpHeader(buffer))
      reply.send(buffer)
    } catch (error) {
      console.error(`error ${error}`)
      reply.code(500).send({ error })
      return
    }
  })

  server.get('/pdf_options', (_, reply) => {
    reply.send(server.getPresetPDFOptions())
  })

  async function getImageBase64(url: string): Promise<string> {
    // Implémentez la logique pour récupérer l'image depuis l'URL et la transformer en base64
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const response: AxiosResponse<ArrayBuffer> = await axios.get(url, {
        responseType: 'arraybuffer',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      })

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const imgBuffer: Buffer = Buffer.from(response.data, 'binary')
      return imgBuffer.toString('base64')
    } catch (error) {
      console.error("Erreur lors du téléchargement de l'image :", error)
      throw error as AxiosError // Gérez l'erreur selon vos besoins
    }
  }

  return server
}
