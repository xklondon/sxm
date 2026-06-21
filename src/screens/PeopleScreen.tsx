import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addPerson,
  fetchPeople,
  removePerson,
  repairPersonByEmail,
  sendPersonInvite,
  updatePerson,
  type PeopleAuditReport,
  type PersonAuditWarning,
  type PersonRecord,
} from '../api/client';
import './PeopleScreen.css';

interface PeopleScreenProps {
  onBack: () => void;
}

const ROLES: PersonRecord['role'][] = ['admin', 'host', 'player', 'guest'];

function warningsForPerson(person: PersonRecord, audit: PeopleAuditReport): PersonAuditWarning[] {
  return audit.warnings.filter((warning) => warning.personIds.includes(person.id));
}

export function PeopleScreen({ onBack }: PeopleScreenProps) {
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [audit, setAudit] = useState<PeopleAuditReport>({
    warnings: [],
    duplicatePersonEmails: [],
    duplicateUserEmails: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<PersonRecord['role']>('player');
  const [devLink, setDevLink] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPeople();
      setPeople(result.people);
      setAudit(result.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const globalWarnings = useMemo(
    () => audit.warnings.filter((warning) => warning.type === 'duplicate_user_email'),
    [audit.warnings],
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDevLink(null);
    setSuccessMessage(null);
    try {
      const result = await addPerson({
        email: newEmail.trim(),
        displayName: newName.trim() || undefined,
        role: newRole,
      });
      if (result.devLink) {
        setDevLink(result.devLink);
      }
      setSuccessMessage(`Added ${result.person.email} and sent invite email.`);
      setNewEmail('');
      setNewName('');
      await reload();
    } catch (err) {
      const inviteErr = err as Error & { inviteEmailFailed?: boolean; person?: PersonRecord };
      if (inviteErr.inviteEmailFailed && inviteErr.person) {
        setSuccessMessage(
          `${inviteErr.person.email} was added to People. The invite email could not be sent.`,
        );
        setNewEmail('');
        setNewName('');
        await reload();
      }
      setError(inviteErr.message || 'Add failed');
    }
  }

  async function patchPerson(id: string, patch: Parameters<typeof updatePerson>[1]) {
    setError(null);
    try {
      await updatePerson(id, patch);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleResendInvite(person: PersonRecord) {
    setError(null);
    setDevLink(null);
    try {
      const result = await sendPersonInvite(person.id);
      if (result.devLink) {
        setDevLink(result.devLink);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    }
  }

  async function handleDisable(person: PersonRecord) {
    if (!window.confirm(`Disable ${person.email}? They will not be able to sign in.`)) {
      return;
    }
    setError(null);
    try {
      await removePerson(person.id);
      setSuccessMessage(`Disabled ${person.email}.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disable failed');
    }
  }

  async function handleDelete(person: PersonRecord) {
    if (
      !window.confirm(
        `Permanently remove ${person.email} from People?\n\nPending invites for this email will be revoked. Table/game history is not deleted.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await removePerson(person.id, { hard: true });
      setSuccessMessage(`Removed ${person.email}.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleRepairEmail(email: string) {
    if (
      !window.confirm(
        `Repair duplicate records for ${email}?\n\nKeeps one canonical Person, links to the User account, and removes duplicate Person rows.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      const result = await repairPersonByEmail(email);
      setSuccessMessage(
        `Repaired ${email}: merged ${result.mergedCount} duplicate(s), updated ${result.membersUpdated} membership(s).`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repair failed');
    }
  }

  return (
    <main className="people-screen">
      <header className="people-screen__header">
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
        <h1>People</h1>
      </header>

      {error && <p className="people-screen__error">{error}</p>}
      {successMessage && <p className="people-screen__success">{successMessage}</p>}
      {devLink && (
        <p className="people-screen__dev-link">
          Dev magic link: <code>{devLink}</code>
        </p>
      )}

      {(audit.warnings.length > 0 || globalWarnings.length > 0) && (
        <section className="people-screen__audit" aria-label="People data warnings">
          <h2>Data warnings</h2>
          <p className="people-screen__audit-intro">
            Duplicate or mismatched Person/User links can cause invite authorization errors. Repair
            by email or remove stale records below.
          </p>
          <ul className="people-screen__audit-list">
            {audit.warnings.map((warning) => (
              <li
                key={`${warning.type}-${warning.normalizedEmail}-${warning.personIds.join('-')}`}
                className={`people-screen__audit-item people-screen__audit-item--${warning.severity}`}
              >
                <span>{warning.message}</span>
                {warning.type === 'duplicate_person_email' ||
                warning.type === 'email_user_mismatch' ||
                warning.type === 'missing_user' ||
                warning.type === 'multiple_persons_per_user' ? (
                  <button
                    type="button"
                    className="secondary people-screen__audit-repair"
                    onClick={() => void handleRepairEmail(warning.normalizedEmail)}
                  >
                    Repair {warning.normalizedEmail}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="people-screen__add" onSubmit={(e) => void handleAdd(e)}>
        <h2>Add person</h2>
        <label>
          Email
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
        </label>
        <label>
          Display name
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </label>
        <label>
          Role
          <select value={newRole ?? 'player'} onChange={(e) => setNewRole(e.target.value as PersonRecord['role'])}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Add & invite</button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="people-screen__table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Link</th>
              <th>Permissions</th>
              <th>Last login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const isRoot = person.role === 'root';
              const rowWarnings = warningsForPerson(person, audit);
              return (
                <tr
                  key={person.id}
                  className={rowWarnings.length > 0 ? 'people-screen__row--warning' : undefined}
                >
                  <td>
                    {person.email}
                    {rowWarnings.length > 0 && (
                      <ul className="people-screen__row-warnings">
                        {rowWarnings.map((warning) => (
                          <li key={`${person.id}-${warning.type}`}>{warning.message}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      defaultValue={person.displayName}
                      disabled={isRoot}
                      onBlur={(e) => {
                        if (e.target.value !== person.displayName) {
                          void patchPerson(person.id, { displayName: e.target.value });
                        }
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={person.role}
                      disabled={isRoot}
                      onChange={(e) =>
                        void patchPerson(person.id, { role: e.target.value as PersonRecord['role'] })
                      }
                    >
                      {[...(isRoot ? (['root'] as const) : []), ...ROLES].map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{person.status}</td>
                  <td className="people-screen__link-cell">
                    {person.userId ? (
                      <span title={person.userId}>Linked</span>
                    ) : (
                      <span className="people-screen__link-missing">No user</span>
                    )}
                  </td>
                  <td className="people-screen__perms">
                    {!isRoot && (
                      <>
                        <label>
                          <input
                            type="checkbox"
                            checked={person.canOwnTables}
                            onChange={(e) =>
                              void patchPerson(person.id, { canOwnTables: e.target.checked })
                            }
                          />
                          Own tables
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={person.canPlay}
                            onChange={(e) => void patchPerson(person.id, { canPlay: e.target.checked })}
                          />
                          Play
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={person.canInvite}
                            onChange={(e) =>
                              void patchPerson(person.id, { canInvite: e.target.checked })
                            }
                          />
                          Invite
                        </label>
                      </>
                    )}
                    {isRoot && <span>All (root)</span>}
                  </td>
                  <td>{person.lastLoginAt ? new Date(person.lastLoginAt).toLocaleString() : '—'}</td>
                  <td className="people-screen__actions">
                    {!isRoot && (
                      <>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => void handleResendInvite(person)}
                        >
                          Resend link
                        </button>
                        {rowWarnings.length > 0 && (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => void handleRepairEmail(person.email)}
                          >
                            Repair
                          </button>
                        )}
                        {person.status !== 'disabled' ? (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => void handleDisable(person)}
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              void patchPerson(person.id, { status: 'active', canLogin: true })
                            }
                          >
                            Enable
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary people-screen__delete-btn"
                          onClick={() => void handleDelete(person)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
