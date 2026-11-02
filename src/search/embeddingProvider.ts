import { config } from '../config';

export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  public async embed(text: string): Promise<number[]> {
    if (!config.embeddingApiKey) {
      throw new Error('EMBEDDING_API_KEY is not configured');
    }

    const response = await fetch(config.embeddingApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.embeddingApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: config.embeddingModel, input: text }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Embedding provider returned HTTP ${response.status}`);
    }

    const result = await response.json() as { data?: Array<{ embedding?: unknown }> };
    const embedding = result.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS ||
      !embedding.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      throw new Error(`Embedding provider must return ${EMBEDDING_DIMENSIONS} finite numeric values`);
    }
    return embedding;
  }
}

let provider: EmbeddingProvider = new OpenAICompatibleEmbeddingProvider();

export function getEmbeddingProvider(): EmbeddingProvider {
  return provider;
}

export function setEmbeddingProvider(nextProvider: EmbeddingProvider): () => void {
  const previousProvider = provider;
  provider = nextProvider;
  return () => {
    provider = previousProvider;
  };
}
