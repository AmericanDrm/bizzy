import { useState, useCallback } from 'react';

export function useCollapsibleForm(initialFieldId?: string | null) {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(initialFieldId ?? null);

  const toggleField = useCallback((fieldId: string) => {
    setActiveFieldId((current) => (current === fieldId ? null : fieldId));
  }, []);

  const collapseAll = useCallback(() => {
    setActiveFieldId(null);
  }, []);

  return { activeFieldId, setActiveFieldId, toggleField, collapseAll };
}
