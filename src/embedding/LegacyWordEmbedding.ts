import math from 'typesdk/math';
import { crc32 } from 'typesdk/algorithms/crc32';

import { MultidimensionalVector } from './vectors';


export type LegacyWordEmbeddingOptions = {
  wordSeparators?: RegExp[];
  caseSensitive?: boolean;
  ignoreStopWords?: boolean;
  stopWords?: string[];
  ignoreNumeric?: boolean;
  ignoreNonAlpha?: boolean;
  negativateRange?: {
    min: number;
    max: number;
  };
  normalize?: boolean;
  inputToVectorEncoding?: 'plain' | 'tfidf' | 'crc32';
  vectorScale?: number;
}


const DEFAULT_OPTIONS: LegacyWordEmbeddingOptions = {
  normalize: true,
  negativateRange: {
    min: 0.26,
    max: 0.79,
  },
  wordSeparators: [/\s+/],
  caseSensitive: true,
  vectorScale: 1,
};

export class LegacyWordEmbedding {
  private readonly _options: LegacyWordEmbeddingOptions;

  constructor(options?: LegacyWordEmbeddingOptions) {
    this._options = Object.assign({}, DEFAULT_OPTIONS, options);
  }

  private _tokenize(text: string): string[] {
    if(typeof this._options.caseSensitive === 'boolean' && !this._options.caseSensitive) {
      text = text.toLowerCase();
    }

    if(this._options.wordSeparators) {
      for(const separator of this._options.wordSeparators) {
        text = text.replace(separator, ' ');
      }
    }

    if(this._options.ignoreNumeric) {
      text = text.replace(/\d+/g, '');
    }

    if(this._options.ignoreNonAlpha) {
      text = text.replace(/[^a-z\s]/g, '');
    }

    if(this._options.ignoreStopWords) {
      const stopWords = this._options.stopWords ?? [];
      text = text.split(' ').filter(word => !stopWords.includes(word)).join(' ');
    }

    return text.split(' ').map(item => item.trim()).filter(Boolean);
  }

  private _mapWords(words: string[]): number[] {
    const output = [] as number[];

    for(let i = 0; i < words.length; i++) {
      for(let j = 0; j < words[i].length; j++) {
        const char = words[i].charCodeAt(j);
        let value = -1;

        switch(this._options.inputToVectorEncoding) {
          case 'plain':
            value = char;
            break;
          case 'tfidf':
            value = char / math.log(i + 2);
            break;
          case 'crc32':
            value = crc32(Buffer.from([char]));
            break;
          default:
            value = char / math.log(i + 2);
            break;
        }

        output.push(value);
      }
    }

    return output;
  }

  public embed(text: string): MultidimensionalVector {
    const words = this._tokenize(text);
    const bytes = this._mapWords(words);

    let vector = new MultidimensionalVector(...bytes);

    if(this._options.vectorScale &&
      typeof this._options.vectorScale === 'number' &&
      ![0, 1].includes(this._options.vectorScale)) {
      vector.scale(this._options.vectorScale);
    }

    if(this._options.normalize !== false) {
      vector.normalize();
    }

    if(this._options.negativateRange) {
      const arr = vector.toArray();

      for(let i = 0; i < arr.length; i++) {
        const byte = arr[i];

        if(byte > this._options.negativateRange.min && byte < this._options.negativateRange.max) {
          arr[i] = math.abs(byte) * -1;
        }
      }

      vector = new MultidimensionalVector(...arr);
    }

    vector.freeze();
    return vector;
  }
}

export default LegacyWordEmbedding;