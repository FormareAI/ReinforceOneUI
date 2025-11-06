export type StrategyMeta = {
  filename: string;
  slug: string;
  mtime?: number;
  title?: string;
};

// 通过 Vite 读取 workspace/strategies 下的 md 文件
const files = import.meta.glob('/workspace/strategies/*.md', { as: 'raw', eager: true });

// 为每个文件构建 URL（不使用 as: 'url'，因为 .md 文件不应该作为模块导入）
function buildFileUrls(rawFiles: Record<string, string>): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const path in rawFiles) {
    urls[path] = path;
  }
  return urls;
}
const fileUrls = buildFileUrls(files);

function slugify(name: string): string {
  return name
    .replace(/\\/g, '/')
    .split('/')
    .pop()!
    .replace(/\.md$/, '');
}

function parseTitle(md: string): string | undefined {
  const firstLine = md.split(/\r?\n/)[0]?.trim();
  if (firstLine?.startsWith('#')) return firstLine.replace(/^#+\s*/, '').trim();
  return undefined;
}

export type StrategyEntry = StrategyMeta & { content: string };

export function loadStrategies(): StrategyEntry[] {
  function getMtimeFromUrlSync(url?: string): number | undefined {
    if (!url) return undefined;
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', url, false);
      xhr.send();
      const lm = xhr.getResponseHeader('Last-Modified');
      const ts = lm ? Date.parse(lm) : NaN;
      return Number.isNaN(ts) ? undefined : ts;
    } catch {
      return undefined;
    }
  }

  const list: StrategyEntry[] = Object.entries(files).map(([path, content]) => {
    const slug = slugify(path);
    const title = parseTitle(content as string) || slug;
    const url = (fileUrls as Record<string, string>)[path];
    const mtime = getMtimeFromUrlSync(url);
    return { filename: path, slug, title, content: content as string, mtime };
  });

  return list.sort((a, b) => {
    if (a.mtime && b.mtime) return b.mtime - a.mtime;
    if (a.mtime && !b.mtime) return -1;
    if (!a.mtime && b.mtime) return 1;
    return b.slug > a.slug ? 1 : -1;
  });
}

export function getStrategyBySlug(slug?: string): StrategyEntry | undefined {
  const items = loadStrategies();
  if (!slug) return items[0];
  return items.find(r => r.slug === slug) ?? items[0];
}


