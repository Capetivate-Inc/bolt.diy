import type { Template } from '~/types/template';

/**
 * Fetches Capetivate templates from a remote manifest. The manifest points at per-template
 * folders containing `template.json` and `system-prompt.md`. Source of truth is
 * `Capetivate-Inc/capetivate-templates` on GitHub; override via VITE_CAPETIVATE_TEMPLATES_URL
 * (points at the raw manifest.json).
 */

const DEFAULT_MANIFEST_URL =
  'https://raw.githubusercontent.com/Capetivate-Inc/capetivate-templates/main/manifest.json';

interface ManifestEntry {
  name: string;
  path: string;
  title: string;
  description: string;
  tags?: string[];
  icon?: string;
}

interface Manifest {
  apiVersion: string;
  kind: string;
  templates: ManifestEntry[];
}

interface TemplateJson {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    title: string;
    description: string;
    icon?: string;
    tags?: string[];
  };
  spec: {
    starter: { type: string; repo: string; notes?: string };
    requiredMcpServers?: Template['requiredMcpServers'];
    systemPromptFile?: string;
    planeProject?: Template['planeProject'];
    inputs?: Template['inputs'];
  };
}

let cache: Template[] | null = null;
let inflight: Promise<Template[]> | null = null;

export async function fetchCapetivateTemplates(): Promise<Template[]> {
  if (cache) {
    return cache;
  }

  if (inflight) {
    return inflight;
  }

  inflight = loadTemplates().then(
    (templates) => {
      cache = templates;
      inflight = null;

      return templates;
    },
    (err) => {
      inflight = null;
      console.warn('[capetivateTemplates] manifest fetch failed; no Capetivate section will render', err);

      return [];
    },
  );

  return inflight;
}

async function loadTemplates(): Promise<Template[]> {
  const manifestUrl = getManifestUrl();
  const manifestResp = await fetch(manifestUrl, { cache: 'no-store' });

  if (!manifestResp.ok) {
    throw new Error(`manifest HTTP ${manifestResp.status}`);
  }

  const manifest = (await manifestResp.json()) as Manifest;

  if (manifest.kind !== 'TemplateManifest') {
    throw new Error(`unexpected manifest kind: ${manifest.kind}`);
  }

  const baseUrl = manifestUrl.replace(/\/manifest\.json$/, '');

  const entries = await Promise.all(
    manifest.templates.map(async (entry) => {
      try {
        return await loadTemplate(baseUrl, entry);
      } catch (err) {
        console.warn(`[capetivateTemplates] skipping ${entry.name}:`, err);

        return null;
      }
    }),
  );

  return entries.filter((t): t is Template => t !== null);
}

async function loadTemplate(baseUrl: string, entry: ManifestEntry): Promise<Template> {
  const templateJsonUrl = `${baseUrl}/${entry.path}/template.json`;
  const resp = await fetch(templateJsonUrl, { cache: 'no-store' });

  if (!resp.ok) {
    throw new Error(`template.json HTTP ${resp.status}`);
  }

  const tj = (await resp.json()) as TemplateJson;

  let systemPrompt: string | undefined;

  if (tj.spec.systemPromptFile) {
    const spUrl = `${baseUrl}/${entry.path}/${tj.spec.systemPromptFile}`;
    const spResp = await fetch(spUrl, { cache: 'no-store' });

    if (spResp.ok) {
      systemPrompt = await spResp.text();
    }
  }

  return {
    name: tj.metadata.name,
    label: tj.metadata.title,
    description: tj.metadata.description,
    githubRepo: tj.spec.starter.repo,
    tags: tj.metadata.tags,
    icon: tj.metadata.icon,
    source: 'capetivate',
    systemPrompt,
    requiredMcpServers: tj.spec.requiredMcpServers,
    inputs: tj.spec.inputs,
    planeProject: tj.spec.planeProject,
  };
}

function getManifestUrl(): string {
  const fromEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_CAPETIVATE_TEMPLATES_URL : undefined;

  return (fromEnv as string | undefined) ?? DEFAULT_MANIFEST_URL;
}
