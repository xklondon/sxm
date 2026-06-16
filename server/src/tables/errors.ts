export class TableNotFoundError extends Error {
  constructor(message = 'Table not found') {
    super(message);
    this.name = 'TableNotFoundError';
  }
}

export class TableMembershipError extends Error {
  constructor(message = 'Not a member of this table') {
    super(message);
    this.name = 'TableMembershipError';
  }
}

export class TableForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TableForbiddenError';
  }
}
