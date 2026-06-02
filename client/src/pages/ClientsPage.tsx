import { useEffect, useMemo, useState } from "react";
import { ClientDrawer } from "../components/ClientDrawer";
import { ClientForm } from "../components/ClientForm";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DetailDrawer } from "../components/DetailDrawer";
import { EmptyState } from "../components/EmptyState";
import { MissingDataChips } from "../components/MissingDataChips";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { useToast } from "../components/ToastProvider";
import { api } from "../lib/api";
import { uniqueValues } from "../lib/format";
import { isMissing, safeLower, safeString } from "../lib/safe";
import { StatusBadge } from "../components/StatusBadge";
import type { Client, ClientDetailResponse, ClientFilters, Project } from "../types";

const defaultFilters: ClientFilters = {
  search: "",
  clientStatus: "",
  clientInvoiceCurrency: "",
  clientManager: "",
  missingContact: false,
  missingDescription: false,
  missingManager: false,
  page: 1,
  pageSize: 10
};

export function ClientsPage({
  refreshToken,
  onDataChange
}: {
  refreshToken: number;
  onDataChange: () => void;
}) {
  const { showToast } = useToast();
  const [filters, setFilters] = useState<ClientFilters>(defaultFilters);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [detail, setDetail] = useState<ClientDetailResponse | null>(null);
  const [editTarget, setEditTarget] = useState<Partial<Client> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.getClients({ ...defaultFilters, page: 1, pageSize: 5000 }),
      api.getProjects({
        search: "",
        manager: "",
        managerEmail: "",
        poNumber: "",
        soldBy: "",
        projectStatus: "",
        projectRegion: "",
        projectCurrency: "",
        missingPoNumber: false,
        missingManager: false,
        missingManagerEmail: false,
        missingStartDate: false,
        missingEndDate: false,
        page: 1,
        pageSize: 5000
      })
    ])
      .then(([clients, projects]) => {
        setAllClients(clients.data);
        setAllProjects(projects.data);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Clients failed to load."))
      .finally(() => setLoading(false));
  }, [refreshToken]);

  const filteredClients = useMemo(() => {
    const search = safeLower(filters.search);
    return allClients.filter((client) => {
      const haystack = safeLower(
        [client.clientName, client.clientContact, client.clientManager, client.clientDescription].join(" ")
      );
      if (search && !haystack.includes(search)) return false;
      if (filters.clientStatus && safeString(client.clientStatus) !== filters.clientStatus) return false;
      if (filters.clientInvoiceCurrency && safeString(client.clientInvoiceCurrency) !== filters.clientInvoiceCurrency) return false;
      if (filters.clientManager && safeString(client.clientManager) !== filters.clientManager) return false;
      if (filters.missingContact && !isMissing(client.clientContact)) return false;
      if (filters.missingDescription && !isMissing(client.clientDescription)) return false;
      if (filters.missingManager && !isMissing(client.clientManager)) return false;
      return true;
    });
  }, [allClients, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const pagedClients = filteredClients.slice((currentPage - 1) * filters.pageSize, currentPage * filters.pageSize);

  const summary = useMemo(() => {
    const active = allClients.filter((client) => safeLower(client.clientStatus) === "active").length;
    return {
      total: allClients.length,
      active,
      inactiveOrOther: allClients.length - active,
      missingContact: allClients.filter((client) => isMissing(client.clientContact)).length,
      missingDescription: allClients.filter((client) => isMissing(client.clientDescription)).length,
      missingManager: allClients.filter((client) => isMissing(client.clientManager)).length
    };
  }, [allClients]);

  const filterOptions = useMemo(
    () => ({
      statuses: uniqueValues(allClients.map((client) => safeString(client.clientStatus))),
      currencies: uniqueValues(allClients.map((client) => safeString(client.clientInvoiceCurrency))),
      managers: uniqueValues(allClients.map((client) => safeString(client.clientManager)))
    }),
    [allClients]
  );

  const openClientDetail = (client: Client) => {
    const relatedProjects = allProjects.filter((project) =>
      safeLower(project.projectName).includes(safeLower(client.clientName))
    );
    setDetail({ client, relatedProjects });
  };

  const applyClientChange = (updated: Client) => {
    setAllClients((prev) => prev.map((client) => (client.id === updated.id ? updated : client)));
    if (detail?.client.id === updated.id) {
      openClientDetail(updated);
    }
    onDataChange();
  };

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Workforce operations"
        title="Clients"
        subtitle="Maintain client records, managers, contacts, and descriptions."
        actions={
          <>
            <button className="button" onClick={() => setFilters(defaultFilters)} type="button">
              Clear filters
            </button>
            <button className="button button--primary" onClick={() => setEditTarget({})} type="button">
              New client
            </button>
          </>
        }
      />

      <section className="stat-grid">
        <StatCard label="Total clients" value={summary.total} tone="accent" />
        <StatCard label="Active clients" value={summary.active} />
        <StatCard label="Inactive / other" value={summary.inactiveOrOther} />
        <StatCard label="Missing contact" value={summary.missingContact} tone="warn" />
        <StatCard label="Missing description" value={summary.missingDescription} tone="warn" />
        <StatCard label="Missing manager" value={summary.missingManager} tone="warn" />
      </section>

      <section className="panel">
        <div className="table-toolbar">
          <div className="table-toolbar__filters filters">
            <input
              placeholder="Search by client name, contact, manager, description"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, page: 1, search: event.target.value }))}
            />
            <select
              value={filters.clientStatus}
              onChange={(event) => setFilters((current) => ({ ...current, page: 1, clientStatus: event.target.value }))}
            >
              <option value="">All statuses</option>
              {filterOptions.statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={filters.clientInvoiceCurrency}
              onChange={(event) =>
                setFilters((current) => ({ ...current, page: 1, clientInvoiceCurrency: event.target.value }))
              }
            >
              <option value="">All currencies</option>
              {filterOptions.currencies.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={filters.clientManager}
              onChange={(event) => setFilters((current) => ({ ...current, page: 1, clientManager: event.target.value }))}
            >
              <option value="">All managers</option>
              {filterOptions.managers.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <label className="toggle">
              <input
                checked={filters.missingContact}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, page: 1, missingContact: event.target.checked }))
                }
                type="checkbox"
              />
              <span>Missing contact</span>
            </label>
            <label className="toggle">
              <input
                checked={filters.missingDescription}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, page: 1, missingDescription: event.target.checked }))
                }
                type="checkbox"
              />
              <span>Missing description</span>
            </label>
            <label className="toggle">
              <input
                checked={filters.missingManager}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, page: 1, missingManager: event.target.checked }))
                }
                type="checkbox"
              />
              <span>Missing manager</span>
            </label>
          </div>

          <div className="table-toolbar__actions">
            <a className="button" href={api.exportUrl("/export/clients")}>
              Export clients
            </a>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Status</th>
                <th>Invoice Currency</th>
                <th>Client Contact</th>
                <th>Client Manager</th>
                <th>Description</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pagedClients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <div className="stack-cell">
                      <strong>{safeString(client.clientName) || "Missing"}</strong>
                      <MissingDataChips
                        items={[
                          ...(isMissing(client.clientManager) ? ["Missing Manager"] : []),
                          ...(isMissing(client.clientContact) ? ["Missing Contact"] : []),
                          ...(isMissing(client.clientDescription) ? ["Missing Description"] : [])
                        ]}
                      />
                    </div>
                  </td>
                  <td><StatusBadge status={client.clientStatus} /></td>
                  <td>{safeString(client.clientInvoiceCurrency) || <span className="missing-badge">Missing</span>}</td>
                  <td className="cell-truncate" title={safeString(client.clientContact)}>
                    {safeString(client.clientContact) || <span className="missing-badge">Missing contact</span>}
                  </td>
                  <td className="cell-truncate" title={safeString(client.clientManager)}>
                    {safeString(client.clientManager) || <span className="missing-badge">Missing manager</span>}
                  </td>
                  <td className="cell-truncate" title={safeString(client.clientDescription)}>
                    {safeString(client.clientDescription)
                      ? `${safeString(client.clientDescription).slice(0, 80)}${safeString(client.clientDescription).length > 80 ? "..." : ""}`
                      : <span className="missing-badge">Missing description</span>}
                  </td>
                  <td className="row-actions">
                    <button className="button button--ghost action-button--compact" onClick={() => openClientDetail(client)} type="button">
                      View
                    </button>
                    <button className="button action-button--compact" onClick={() => setEditTarget(client)} type="button">
                      Edit
                    </button>
                    <button className="button button--danger action-button--compact" onClick={() => setDeleteTarget(client)} type="button">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!pagedClients.length && !loading ? (
          <EmptyState
            title="No clients match the current filters."
            description="Clear one or more filters to broaden the client list."
            compact
          />
        ) : null}
        <div className="pagination">
          <span>
            Page {currentPage} of {totalPages} • {filteredClients.length} clients
          </span>
          <div className="pagination__actions">
            <button
              className="button"
              disabled={currentPage <= 1}
              onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
              type="button"
            >
              Previous
            </button>
            <button
              className="button"
              disabled={currentPage >= totalPages}
              onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
        {loading ? <EmptyState title="Loading clients..." description="Pulling the client directory." tone="loading" compact /> : null}
        {error ? <EmptyState title="Unable to load clients." description={error} tone="error" compact /> : null}
      </section>

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={editTarget?.id ? "Edit client" : "Create client"}
      >
        <ClientForm
          initialValue={editTarget ?? undefined}
          onSubmit={async (payload) => {
            if (editTarget?.id) {
              const updated = await api.updateClient(editTarget.id, payload);
              applyClientChange(updated);
              showToast({ tone: "success", title: "Client updated", description: `${updated.clientName} was saved.` });
            } else {
              const created = await api.createClient(payload);
              setAllClients((prev) => [created, ...prev]);
              onDataChange();
              showToast({ tone: "success", title: "Client created", description: `${created.clientName} was added.` });
            }
            setEditTarget(null);
          }}
          submitLabel={editTarget?.id ? "Save changes" : "Create client"}
        />
      </Modal>

      <DetailDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.client.clientName ?? "Client details"}
        subtitle={detail?.client.clientStatus || "Client profile"}
      >
        <ClientDrawer detail={detail} onClose={() => setDetail(null)} embedded />
      </DetailDrawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.deleteClient(deleteTarget.id);
          setAllClients((prev) => prev.filter((client) => client.id !== deleteTarget.id));
          onDataChange();
          showToast({ tone: "success", title: "Client deleted", description: `${deleteTarget.clientName} was removed.` });
        }}
        title="Delete client"
        message={`Are you sure you want to delete ${deleteTarget?.clientName ?? "this client"}?`}
      />
    </div>
  );
}
