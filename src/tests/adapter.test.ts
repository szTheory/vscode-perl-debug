/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import * as Path from 'path';
import {DebugClient} from 'vscode-debugadapter-testsupport';
import {DebugProtocol} from 'vscode-debugprotocol';


suite('Perl debug Adapter', () => {

	const DEBUG_ADAPTER = './out/perlDebug.js';

	const PROJECT_ROOT = Path.join(__dirname, '../../');
	const DATA_ROOT = Path.join(PROJECT_ROOT, 'src/tests/data/');

	const FILE_TEST_PL = 'slow_test.pl';
	const FILE_TEST_NESTED_PL = 'test_nested.pl';
	const FILE_MODULE = 'Module.pm';
	const FILE_NESTED_MODULE = 'Module2.pm';
	const FILE_FICTIVE = 'Fictive.pl';
	const FILE_BROKEN_SYNTAX = 'broken_syntax.pl';
	const FILE_BROKEN_CODE = 'broken_code.pl';
	const FILE_PRINT_ARGUMENTS = 'print_arguments.pl';
	const FILE_FAST_TEST_PL = 'fast_test.pl';

	const defaultLaunchConfig = {
		type: 'perl',
		request: 'launch',
		exec: 'perl',
		execArgs: [],
		name: 'Perl-Debug',
		root: DATA_ROOT,
		program: FILE_FAST_TEST_PL,
		inc: [],
		args: [],
		stopOnEntry: false
	};

	const Configuration = (obj: Object) => {
		return Object.assign({}, defaultLaunchConfig, obj);
	};

	let dc: DebugClient;

	setup( () => {
		dc = new DebugClient('node', DEBUG_ADAPTER, 'mock');
		return dc.start();
	});

	teardown( () => dc.stop() );


	suite('basic', () => {

		test('unknown request should produce error', done => {
			dc.send('illegal_request').then(() => {
				done(new Error("does not report error on unknown request"));
			}).catch(() => {
				done();
			});
		});
	});

	suite('initialize', () => {

		test('should return supported features', () => {
			return dc.initializeRequest().then(response => {
				assert.equal(response.body.supportsConfigurationDoneRequest, true);
			});
		});

		test('should produce error for invalid \'pathFormat\'', done => {
			dc.initializeRequest({
				adapterID: 'mock',
				linesStartAt1: true,
				columnsStartAt1: true,
				pathFormat: 'url'
			}).then(response => {
				done(new Error("does not report error on invalid 'pathFormat' attribute"));
			}).catch(err => {
				// error expected
				done();
			});
		});
	});

	suite('launch', () => {

		test('should run program to the end', () => {

			const PROGRAM = Path.join(DATA_ROOT, FILE_FAST_TEST_PL);

			return Promise.all([
				dc.configurationSequence(),
				dc.launch(Configuration({ program: PROGRAM })),
				dc.waitForEvent('terminated')
			]);
		});

		test('should stop on entry', () => {

			const PROGRAM = Path.join(DATA_ROOT, FILE_FAST_TEST_PL);
			const ENTRY_LINE = 5;

			return Promise.all([
				dc.configurationSequence(),
				dc.launch(Configuration({ program: PROGRAM, stopOnEntry: true })),
				dc.assertStoppedLocation('entry', { line: ENTRY_LINE } )
			]);
		});
	});

	// xxx: Need to figure out this test
	suite.skip('setBreakpoints', () => {

		test('should stop on a breakpoint', () => {

			const PROGRAM = Path.join(DATA_ROOT, FILE_FAST_TEST_PL);
			const BREAKPOINT_LINE = 6;

			return dc.hitBreakpoint(Configuration({ program: PROGRAM }), { path: PROGRAM, line: BREAKPOINT_LINE } );
		});

		test('hitting a lazy breakpoint should send a breakpoint event', () => {

			const PROGRAM = Path.join(DATA_ROOT, FILE_FAST_TEST_PL);
			const BREAKPOINT_LINE = 6;

			return Promise.all([

				dc.hitBreakpoint(({ program: PROGRAM }), { path: PROGRAM, line: BREAKPOINT_LINE, verified: false } ),

				dc.waitForEvent('breakpoint').then((event : DebugProtocol.BreakpointEvent ) => {
					assert.equal(event.body.breakpoint.verified, true, "event mismatch: verified");
				})

			]);

		});

	});

	suite('setExceptionBreakpoints', () => {

		test('should stop on an exception', () => {

			const PROGRAM_WITH_EXCEPTION = Path.join(DATA_ROOT, FILE_BROKEN_CODE);
			const EXCEPTION_LINE = 10;

			return Promise.all([

				dc.waitForEvent('initialized').then(event => {
					return dc.setExceptionBreakpointsRequest({
						filters: [ 'all' ]
					});
				}).then(response => {
					return dc.configurationDoneRequest();
				}),

				dc.launch(Configuration({ program: PROGRAM_WITH_EXCEPTION })),

				dc.assertStoppedLocation('exception', { line: EXCEPTION_LINE } )
			]);
		});
	});
});