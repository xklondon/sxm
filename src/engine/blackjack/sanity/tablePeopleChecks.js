import { buildTableBankRow, buildTablePeopleRows } from '../../session/tablePeople';
import { baseTestTable, tableWithClaimedBox } from './fixtures';
import { check } from './types';
export function runTablePeopleSanityChecks() {
    const results = [];
    const empty = baseTestTable();
    const bankEmpty = buildTableBankRow(empty);
    results.push(check('bank row exists after setup', Boolean(bankEmpty)));
    results.push(check('setup lists owner person row before box claim', buildTablePeopleRows(empty).some((r) => r.kind === 'person' && r.status === 'owner' && r.available === 500)));
    const claimed = tableWithClaimedBox(1);
    const people = buildTablePeopleRows(claimed);
    results.push(check('claimed box creates person row', people.some((p) => p.kind === 'person')));
    results.push(check('person row lists box slots not separate box bankrolls', people.every((p) => p.kind === 'person' || p.kind === 'invite')));
    results.push(check('active person shows available chips', people.some((p) => p.kind === 'person' && p.available > 0)));
    return { passed: results.every((r) => r.passed), results };
}
