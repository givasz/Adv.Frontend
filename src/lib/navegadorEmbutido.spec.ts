import { describe, expect, it } from 'vitest'
import { navegadorEmbutido } from './navegadorEmbutido'

// O Google recusa login dentro destes — o botão não pode aparecer neles.
const EMBUTIDOS = {
  'Instagram no iPhone':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone13,2; iOS 17_5; pt_BR; pt; scale=3.00; 1170x2532; 612761493)',
  'Instagram no Android':
    'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36 Instagram 346.0.0.34.108 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; pt_BR; 636215482)',
  'Facebook no Android':
    'Mozilla/5.0 (Linux; Android 13; moto g54 5G; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/479.0.0.51.74;]',
  'Facebook no iPhone':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/476.0.0.39.107;FBBV/640227520;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBLC/pt_BR]',
  'LinkedIn no iPhone':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1234',
  'WebView genérico do Android':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.88 Mobile Safari/537.36',
}

// E nestes ele TEM de aparecer.
const NAVEGADORES = {
  'Chrome no Android':
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  'Safari no iPhone':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Chrome no Windows':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Samsung Internet':
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
}

describe('navegador de dentro de aplicativo', () => {
  it.each(Object.entries(EMBUTIDOS))('%s: embutido', (_nome, ua) => {
    expect(navegadorEmbutido(ua)).toBe(true)
  })

  it.each(Object.entries(NAVEGADORES))('%s: navegador de verdade', (_nome, ua) => {
    expect(navegadorEmbutido(ua)).toBe(false)
  })

  it('sem user agent, não esconde o botão', () => {
    expect(navegadorEmbutido('')).toBe(false)
  })
})
