export interface Template {
  name: string;
  label: string;
  description: string;
  githubRepo: string;
  tags?: string[];
  icon?: string;

  // Capetivate-only fields (optional, backwards-compatible).
  // Populated when a template is loaded from the Capetivate-Templates manifest.
  source?: 'upstream' | 'capetivate';
  systemPrompt?: string;
  requiredMcpServers?: CapetivateMcpRequirement[];
  inputs?: TemplateInput[];
  planeProject?: {
    autoCreate?: boolean;
    nameTemplate?: string;
    tasksFromPhases?: boolean;
  };
}

export interface CapetivateMcpRequirement {
  name: string;
  purpose?: string;
  toolsExpected?: string[];
  toolsLive?: string[];
}

export interface TemplateInput {
  name: string;
  title: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  hint?: string;
}
