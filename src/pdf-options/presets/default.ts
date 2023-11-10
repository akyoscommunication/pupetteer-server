/**
 * @see https://github.com/puppeteer/puppeteer/blob/v5.3.1/docs/api.md#pagepdfoptions
 */

import { PDFMargin, PDFOptions } from 'puppeteer'

import {
  DEFAULT_PDF_OPTION_FORMAT,
  DEFAULT_PDF_OPTION_LANDSCAPE,
  DEFAULT_PDF_OPTION_MARGIN,
} from '../../config'

const defaultMargin: PDFMargin = {
  top: DEFAULT_PDF_OPTION_MARGIN,
  bottom: DEFAULT_PDF_OPTION_MARGIN,
  left: DEFAULT_PDF_OPTION_MARGIN,
  right: DEFAULT_PDF_OPTION_MARGIN,
}

export const PresetPDFOptions: { [key: string]: PDFOptions } = {
  DEFAULT: {
    format: DEFAULT_PDF_OPTION_FORMAT,
    landscape: DEFAULT_PDF_OPTION_LANDSCAPE,
    margin: defaultMargin,
    printBackground: true,
  },
  A4: {
    format: 'a4',
    margin: defaultMargin,
    printBackground: true,
  },
  A3: {
    format: 'a3',
    margin: defaultMargin,
    printBackground: true,
  },
  A4L: {
    format: 'a4',
    landscape: true,
    margin: defaultMargin,
    printBackground: true,
  },
  A3L: {
    format: 'a3',
    landscape: true,
    margin: defaultMargin,
    printBackground: true,
  },
  nomargin: {
    format: 'a4',
    landscape: false,
    margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    printBackground: true,
  },
  bottommargin: {
    format: 'a4',
    landscape: false,
    margin: { top: '0mm', bottom: '0.5cm', left: '0mm', right: '0mm' },
    printBackground: true,
  },
  landscape: {
    format: 'a4',
    landscape: true,
    margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    printBackground: true,
  },
  A4headerfooter: {
    format: 'a4',
    margin: { top: '40mm', bottom: '30mm', left: '0.5cm', right: '0.5cm' },
    printBackground: true,
    displayHeaderFooter: true,
  },
}
