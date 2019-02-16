import assert = require('assert');
import * as Path from 'path';
import { perlDebuggerConnection, RequestResponse } from '../adapter';
import { LocalSession } from '../localSession';

const PROJECT_ROOT = Path.join(__dirname, '../../');
const DATA_ROOT = Path.join(PROJECT_ROOT, 'src/tests/data/');

const FILE_TEST_PL = 'slow_test.pl';

const launchOptions = {
	env: {
		PATH: process.env.PATH || '',
		PERL5LIB: process.env.PERL5LIB || '',
	},
};

describe('Perl debugger connection', () => {

	let conn: perlDebuggerConnection;

	beforeEach(() => {
		conn = new perlDebuggerConnection();
		return conn.initializeRequest();
	});

	afterEach(() => {
		conn.destroy();
		conn = null;
	});

	it('Should be able to get remote expression values from ' + FILE_TEST_PL, async () => {

		// TODO(bh): refactor remote debugger setup into helper function?

		const port = 5000 + Math.round(Math.random()*100); // Not to conflict with VS Code jest ext
		// Listen for remote debugger session
		const server = conn.launchRequest(FILE_TEST_PL, DATA_ROOT, [], {
			...launchOptions,
			port, // Trigger server
		});
		// Start "remote" debug session
		const local = new LocalSession(FILE_TEST_PL, DATA_ROOT, [], {
			...launchOptions,
			env: {
				...launchOptions.env,
				PERLDB_OPTS: `RemotePort=localhost:${port}`, // Trigger remote debugger
			},
		});

		// Wait for result
		const res = await server;

		// Ask Perl for the PID of the Perl process
		const expressionValue = await conn.getExpressionValue('$$');

		// Cleanup
		local.kill();
		conn.perlDebugger.kill();

		assert.equal(Number.parseInt(expressionValue), local.pid);
		assert.equal(res.finished, false);
		assert.equal(res.exception, false);
		assert.equal(res.ln, 5); // The first code line in test.pl is 5
	});

});
