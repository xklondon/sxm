import { useCallback, useEffect, useState } from 'react';
import {
  addPerson,
  fetchPeople,
  sendPersonInvite,
  updatePerson,
  type PersonRecord,
} from '../api/client';
import './PeopleScreen.css';

interface PeopleScreenProps {
  onBack: () => void;
}

const ROLES: PersonRecord['role'][] = ['admin', 'host', 'player', 'guest'];

export function PeopleScreen({ onBack }: PeopleScreenProps) {
  const [people, setPeople] = useState<PersonRecord[]>([]);
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
      setPeople(await fetchPeople());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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
      setError(err instanceof Error ? err.message : 'Add failed');
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
              <th>Permissions</th>
              <th>Last login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const isRoot = person.role === 'root';
              return (
                <tr key={person.id}>
                  <td>{person.email}</td>
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
                  <td>
                    {!isRoot && (
                      <>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => void handleResendInvite(person)}
                        >
                          Resend link
                        </button>
                        {person.status !== 'disabled' ? (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => void patchPerson(person.id, { status: 'disabled', canLogin: false })}
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
