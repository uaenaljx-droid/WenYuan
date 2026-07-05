export function createAvatarTextureCache({ load, create, fallback, dispose } = {}) {
  const cache = new Map();

  function get(key, persona) {
    if (!key) return Promise.resolve(fallback?.(persona));
    const cached = cache.get(key);
    if (cached) return cached instanceof Promise ? cached : Promise.resolve(cached);
    const pending = load(key)
      .then((image) => create(persona, image))
      .catch(() => fallback?.(persona))
      .then((texture) => {
        cache.set(key, texture);
        return texture;
      });
    cache.set(key, pending);
    return pending;
  }

  function set(key, value) {
    cache.set(key, value);
    return value;
  }

  function has(key) {
    return cache.has(key);
  }

  function size() {
    return cache.size;
  }

  function values() {
    return cache.values();
  }

  function clear() {
    for (const value of cache.values()) {
      if (value?.isTexture) dispose?.(value);
    }
    cache.clear();
  }

  return { get, set, has, size, values, clear };
}
