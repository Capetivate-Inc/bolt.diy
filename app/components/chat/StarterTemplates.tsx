import React, { useEffect, useState } from 'react';
import type { Template } from '~/types/template';
import { STARTER_TEMPLATES } from '~/utils/constants';
import { fetchCapetivateTemplates } from '~/utils/capetivateTemplates';

interface FrameworkLinkProps {
  template: Template;
}

const FrameworkLink: React.FC<FrameworkLinkProps> = ({ template }) => (
  <a
    href={`/git?url=https://github.com/${template.githubRepo}.git`}
    data-state="closed"
    data-discover="true"
    className="items-center justify-center"
  >
    <div
      className={`inline-block ${template.icon} w-8 h-8 text-4xl transition-theme hover:text-purple-500 dark:text-white dark:opacity-50 dark:hover:opacity-100 dark:hover:text-purple-400 transition-all grayscale hover:grayscale-0 transition`}
      title={template.label}
    />
  </a>
);

const CapetivateTemplateCard: React.FC<{ template: Template }> = ({ template }) => {
  const toolsLive = template.requiredMcpServers?.flatMap((s) => s.toolsLive ?? []) ?? [];
  const toolsExpected = template.requiredMcpServers?.flatMap((s) => s.toolsExpected ?? []) ?? [];
  const readiness =
    toolsExpected.length > 0 ? `${toolsLive.length} / ${toolsExpected.length} MCP tools live` : null;

  return (
    <a
      href={`/git?url=https://github.com/${template.githubRepo}.git`}
      className="block w-full max-w-md px-4 py-3 rounded-lg border border-bolt-elements-borderColor hover:border-purple-500 transition-colors text-left"
      title={template.description}
    >
      <div className="flex items-start gap-3">
        {template.icon && (
          <div className={`${template.icon} w-6 h-6 text-2xl flex-shrink-0 mt-0.5 text-purple-500`} />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-bolt-elements-textPrimary">{template.label}</div>
          <div className="text-sm text-bolt-elements-textSecondary mt-0.5 line-clamp-2">{template.description}</div>
          {readiness && <div className="text-xs text-bolt-elements-textTertiary mt-1.5">{readiness}</div>}
        </div>
      </div>
    </a>
  );
};

const StarterTemplates: React.FC = () => {
  const [capetivateTemplates, setCapetivateTemplates] = useState<Template[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchCapetivateTemplates().then((templates) => {
      if (!cancelled) {
        setCapetivateTemplates(templates);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      {capetivateTemplates.length > 0 && (
        <div className="flex flex-col items-center gap-3 w-full">
          <span className="text-sm text-gray-500">Capetivate templates</span>
          <div className="flex flex-col gap-2 w-full max-w-md">
            {capetivateTemplates.map((template) => (
              <CapetivateTemplateCard key={template.name} template={template} />
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col items-center gap-4">
        <span className="text-sm text-gray-500">or start a blank app with your favorite stack</span>
        <div className="flex justify-center">
          <div className="flex flex-wrap justify-center items-center gap-4 max-w-sm">
            {STARTER_TEMPLATES.map((template) => (
              <FrameworkLink key={template.name} template={template} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StarterTemplates;
