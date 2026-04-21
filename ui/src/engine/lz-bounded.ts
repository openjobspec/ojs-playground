const URI_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$'
const URI_VALUES = new Map(Array.from(URI_ALPHABET, (char, index) => [char, index]))

export type BoundedDecompressResult =
  | { ok: true; value: string }
  | { ok: false; reason: 'invalid' | 'too_large' }

/**
 * LZ-String URI decoding with output and dictionary-memory bounds. This keeps
 * legacy share links compatible without allowing decompression to allocate an
 * attacker-selected amount of memory before validation.
 */
export function boundedDecompressFromEncodedURIComponent(
  encoded: string,
  maxOutputLength: number,
): BoundedDecompressResult {
  if (!encoded || maxOutputLength <= 0) return { ok: false, reason: 'invalid' }
  const input = encoded.replace(/ /g, '+')
  if (!/^[A-Za-z0-9+\-$]+$/.test(input)) return { ok: false, reason: 'invalid' }

  const firstValue = URI_VALUES.get(input.charAt(0))
  if (firstValue === undefined) return { ok: false, reason: 'invalid' }

  const data = {
    value: firstValue,
    position: 32,
    index: 1,
  }

  const readBits = (count: number): number | null => {
    let bits = 0
    let power = 1
    const maxPower = 2 ** count
    while (power !== maxPower) {
      const bit = data.value & data.position
      data.position >>= 1
      if (data.position === 0) {
        data.position = 32
        if (data.index >= input.length) {
          data.value = 0
        } else {
          const next = URI_VALUES.get(input.charAt(data.index))
          if (next === undefined) return null
          data.value = next
        }
        data.index++
      }
      if (bit > 0) bits |= power
      power <<= 1
    }
    return bits
  }

  const dictionary: string[] = ['', '', '']
  let enlargeIn = 4
  let dictionarySize = 4
  let numberOfBits = 3
  let dictionaryCharacters = 0

  const marker = readBits(2)
  if (marker === null) return { ok: false, reason: 'invalid' }
  if (marker === 2) return { ok: true, value: '' }
  const firstCode = readBits(marker === 0 ? 8 : 16)
  if (firstCode === null) return { ok: false, reason: 'invalid' }

  let word = String.fromCharCode(firstCode)
  dictionary[3] = word
  dictionaryCharacters += word.length
  const result: string[] = [word]
  let outputLength = word.length

  while (true) {
    if (data.index > input.length + 1) return { ok: false, reason: 'invalid' }

    let code = readBits(numberOfBits)
    if (code === null) return { ok: false, reason: 'invalid' }

    if (code === 0 || code === 1) {
      const characterCode = readBits(code === 0 ? 8 : 16)
      if (characterCode === null) return { ok: false, reason: 'invalid' }
      const character = String.fromCharCode(characterCode)
      dictionary[dictionarySize++] = character
      dictionaryCharacters += character.length
      code = dictionarySize - 1
      enlargeIn--
    } else if (code === 2) {
      return { ok: true, value: result.join('') }
    }

    if (enlargeIn === 0) {
      enlargeIn = 2 ** numberOfBits
      numberOfBits++
    }

    let entry: string
    if (dictionary[code] !== undefined) {
      entry = dictionary[code]!
    } else if (code === dictionarySize) {
      entry = word + word.charAt(0)
    } else {
      return { ok: false, reason: 'invalid' }
    }

    if (outputLength + entry.length > maxOutputLength) {
      return { ok: false, reason: 'too_large' }
    }
    result.push(entry)
    outputLength += entry.length

    const nextDictionaryEntry = word + entry.charAt(0)
    dictionaryCharacters += nextDictionaryEntry.length
    if (dictionaryCharacters > maxOutputLength * 4) {
      return { ok: false, reason: 'too_large' }
    }
    dictionary[dictionarySize++] = nextDictionaryEntry
    enlargeIn--
    word = entry

    if (enlargeIn === 0) {
      enlargeIn = 2 ** numberOfBits
      numberOfBits++
    }
  }
}
