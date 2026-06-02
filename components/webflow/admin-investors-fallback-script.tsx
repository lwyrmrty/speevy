const fallbackScript = `
(() => {
  window.setTimeout(() => {
  if (window.__speevyAdminInvestorsHydrated) return;

  const table = document.querySelector('.contenttable.tooltip-table');
  const bulkActions = document.querySelector('[data-bulk-actions]');
  if (!table || !bulkActions || bulkActions.dataset.fallbackReady === 'true') return;

  bulkActions.dataset.fallbackReady = 'true';

  const selected = new Set();
  const count = bulkActions.querySelector('[data-selected-count]');
  const label = bulkActions.querySelector('[data-selected-label]');
  const approve = bulkActions.querySelector('[data-bulk-approve]');
  const help = bulkActions.querySelector('[data-bulk-approve-help]');
  const clear = bulkActions.querySelector('[data-bulk-clear]');
  const rows = () => Array.from(table.querySelectorAll('[data-investor-row]'));
  const checkboxes = () => Array.from(table.querySelectorAll('[data-investor-checkbox]'));
  const originalRows = rows();
  originalRows.forEach((row, index) => {
    row.dataset.originalIndex = String(index);
  });
  const sortState = { field: null, direction: null };

  function sync() {
    rows().forEach((row) => {
      const isSelected = selected.has(row.dataset.investorId);
      row.classList.toggle('selected', isSelected);
    });

    checkboxes().forEach((checkbox) => {
      const isSelected = selected.has(checkbox.dataset.investorId);
      checkbox.classList.toggle('checked', isSelected);
      checkbox.setAttribute('aria-pressed', String(isSelected));
      const label = checkbox.getAttribute('aria-label') || '';
      checkbox.setAttribute('aria-label', label.replace(/^Select|^Deselect/, isSelected ? 'Deselect' : 'Select'));
    });

    const selectedRows = rows().filter((row) => selected.has(row.dataset.investorId));
    const selectedCount = selectedRows.length;
    const canApprove = selectedCount > 0 && selectedRows.every((row) => row.dataset.investorStatus === 'pending_review');

    bulkActions.hidden = selectedCount === 0;
    if (count) count.textContent = String(selectedCount);
    if (label) label.textContent = selectedCount === 1 ? ' investor selected' : ' investors selected';
    if (approve) approve.disabled = !canApprove;
    if (help) help.hidden = canApprove;
  }

  checkboxes().forEach((checkbox) => {
    checkbox.addEventListener('click', () => {
      const id = checkbox.dataset.investorId;
      if (!id) return;

      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      sync();
    });
  });

  const selectAll = table.querySelector('.tablerow.headerrow .checkboxtoggle');
  if (selectAll) {
    selectAll.addEventListener('click', () => {
      const allIds = rows().map((row) => row.dataset.investorId).filter(Boolean);
      const shouldSelectAll = selected.size !== allIds.length;
      selected.clear();
      if (shouldSelectAll) allIds.forEach((id) => selected.add(id));
      selectAll.classList.toggle('checked', shouldSelectAll);
      selectAll.setAttribute('aria-pressed', String(shouldSelectAll));
      sync();
    });
  }

  if (clear) {
    clear.addEventListener('click', () => {
      selected.clear();
      if (selectAll) {
        selectAll.classList.remove('checked');
        selectAll.setAttribute('aria-pressed', 'false');
      }
      sync();
    });
  }

  if (approve) {
    approve.addEventListener('click', async () => {
      const ids = Array.from(selected);
      if (!ids.length || approve.disabled) return;

      approve.disabled = true;
      const text = approve.querySelector('div');
      if (text) text.textContent = 'Approving...';

      const response = await fetch('/admin/investors/bulk-approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (response.ok) window.location.reload();
      else {
        if (text) text.textContent = 'Approve Selected';
        approve.disabled = false;
      }
    });
  }

  table.querySelectorAll('[data-sort-field]').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.dataset.sortField;
      if (!field) return;

      if (sortState.field !== field) {
        sortState.field = field;
        sortState.direction = 'desc';
      } else if (sortState.direction === 'desc') {
        sortState.direction = 'asc';
      } else {
        sortState.field = null;
        sortState.direction = null;
      }

      table.querySelectorAll('[data-sort-field]').forEach((sortButton) => {
        const indicator = sortButton.querySelector('.speevy-sort-indicator');
        const active = sortState.field === sortButton.dataset.sortField;
        sortButton.setAttribute('aria-pressed', String(active));
        if (indicator) indicator.textContent = active ? (sortState.direction === 'desc' ? '↓' : '↑') : '↕';
      });

      const sortedRows = rows().sort((left, right) => {
        if (!sortState.field) {
          return Number(left.dataset.originalIndex || 0) - Number(right.dataset.originalIndex || 0);
        }

        const leftValue = Number(left.dataset[sortState.field] || -1);
        const rightValue = Number(right.dataset[sortState.field] || -1);
        const difference = leftValue - rightValue;
        const direction = sortState.direction === 'desc' ? -1 : 1;
        if (difference !== 0) return difference * direction;
        return Number(left.dataset.originalIndex || 0) - Number(right.dataset.originalIndex || 0);
      });

      sortedRows.forEach((row) => table.appendChild(row));
    });
  });
  }, 500);
})();
`;

export function AdminInvestorsFallbackScript() {
  return <script dangerouslySetInnerHTML={{ __html: fallbackScript }} />;
}
