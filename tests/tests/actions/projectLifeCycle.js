'use strict';

/**
 * Test: Project Lifecycle
 * - Project Init
 * - Stage Create
 * - Region Create
 * - Resources Deploy
 * - Resources Remove
 * - Region Remove
 * - Stage Remove
 * - Project Remove
 */


let Serverless  = require('../../../lib/Serverless'),
  SError      = require('../../../lib/Error'),
  path        = require('path'),
  os          = require('os'),
  uuid        = require('node-uuid'),
  utils       = require('../../../lib/utils/index'),
  assert      = require('chai').assert,
  wrench    = require('wrench'),
  shortid     = require('shortid'),
  testUtils = require('../../test_utils'),
  config      = require('../../config');


let serverless = new Serverless( undefined, {
  interactive: false,
  awsAdminKeyId: config.awsAdminKeyId,
  awsAdminSecretKey: config.awsAdminSecretKey
});

// Removes project S3 bucket
let cleanup = function(evt) {
  let project = serverless.getProject();

  // Project Create no longer creates a Project Bucket if noExeCf is set
  if (evt.options.noExeCf) return;

  let s3 = require('../../../lib/utils/aws/S3')({
    region:          project.getVariables().projectBucketRegion,
    accessKeyId:     config.awsAdminKeyId,
    secretAccessKey: config.awsAdminSecretKey
  });

  // Delete Region Bucket
  // Delete All Objects in Bucket first, this is required
  s3.listObjectsPromised({Bucket: project.getVariables().projectBucket})
    .then(function(data) {
      let params = {
        Bucket: project.getVariables().projectBucket,
        Delete: {}
      };

      params.Delete.Objects = data.Contents.map((content) => ({Key: content.Key}));

      return s3.deleteObjectsPromised(params);
    })
    .then(() => s3.deleteBucketPromised({Bucket: project.getVariables().projectBucket}))
};

/**
 * Tests
 */

describe('Test: Project Live Cycle', function() {
  this.timeout(0);

  describe('Test action: Project Init', function() {

    before(function(done) {
      process.chdir(os.tmpdir());

      serverless.init().then(function(){
        done();
      });
    });

    describe('Project Init', function() {
      it('should create a new project in temp directory', function() {

        this.timeout(0);

        let name    = ('testprj-' + uuid.v4()).replace(/-/g, '');
        let bucket  = name + '.com';
        let evt   = {
          options: {
            name:               name,
            bucket:             bucket,
            profile:            config.profile,
            stage:              config.stage,
            region:             config.region,
            noExeCf:            config.noExecuteCf
          }
        };

        /**
         * Validate Event
         * - Validate an event object's properties
         */

        let validateEvent = function(evt) {
          assert.equal(true, typeof evt.options.name !== 'undefined');
          assert.equal(true, typeof evt.options.bucket !== 'undefined');
          assert.equal(true, typeof evt.options.region !== 'undefined');
          assert.equal(true, typeof evt.options.noExeCf !== 'undefined');
          assert.equal(true, typeof evt.options.stage !== 'undefined');
          assert.equal(true, typeof evt.data !== 'undefined');
        };

        return serverless.actions.projectInit(evt)
          .then(function(evt) {

            let project = serverless.getProject();
            let stage   = project.getStage(config.stage);
            let region  = project.getRegion(config.stage, config.region);

            assert.equal(true, typeof project.getVariables().project != 'undefined');
            assert.equal(true, typeof project.getVariables().projectBucket != 'undefined');
            assert.equal(true, typeof project.getVariables().projectBucketRegion != 'undefined');
            assert.equal(true, typeof stage.getVariables().stage != 'undefined');
            assert.equal(true, typeof region.getVariables().region != 'undefined');
            if (!config.noExecuteCf) {
              assert.equal(true, typeof region.getVariables().iamRoleArnLambda != 'undefined');
              assert.equal(true, typeof region.getVariables().resourcesStackName != 'undefined');

            }

            // Validate Event
            validateEvent(evt);
          });
      });
    });
  });

  describe('Test Action: Stage Create', function() {

    describe('Stage Create', function() {

      it('should create stage', function() {
        let evt = {
          options: {
            stage:      config.stage2,
            region:     config.region,
            profile:    config.profile,
            noExeCf:    config.noExecuteCf
          }
        };

        let validateEvent = function(evt) {
          assert.equal(true, typeof evt.options.region !== 'undefined');
          assert.equal(true, typeof evt.options.stage !== 'undefined');
          assert.equal(true, typeof evt.data !== 'undefined');
        };

        return serverless.actions.stageCreate(evt)
          .then(function(evt) {

            let project = serverless.getProject();
            assert.equal(project.getStage(config.stage2).getVariables().stage, config.stage2);
            assert.equal(project.getRegion(config.stage2, config.region).getVariables().region, config.region);

            // Validate EVT
            validateEvent(evt);
          });
      });
    });
  });

  describe('Test Action: Region Create', function() {

    describe('Region Create', function() {

      it('should create region', function() {

        let evt = {
          options: {
            stage:      config.stage2,
            region:     config.region2,
            noExeCf:    false
          }
        };

        let validateEvent = function(evt) {
          assert.equal(true, typeof evt.options.region !== 'undefined');
          assert.equal(true, typeof evt.options.stage !== 'undefined');
          assert.equal(true, typeof evt.data !== 'undefined');
        };

        return serverless.actions.regionCreate(evt)
          .then(function(evt) {
            assert.equal(true, typeof serverless.getProject().getRegion(config.stage2, config.region2).getVariables().region != 'undefined');

            // Validate Event
            validateEvent(evt);
          });
      });
    });
  });

  describe('Test action: Resources Deploy', function() {

    describe('Resources Deploy positive tests', function() {

      it('deploys an updated CF template', function() {

        let evt = {
          stage:      config.stage2,
          region:     config.region2,
          noExeCf:    config.noExecuteCf
        };

        let validateEvent = function(evt) {
          assert.equal(true, typeof evt.options.region !== 'undefined');
          assert.equal(true, typeof evt.options.stage !== 'undefined');
          assert.equal(true, typeof evt.data !== 'undefined');
        };

        return serverless.actions.resourcesDeploy(evt)
          .then(validateEvent);
      });
    });
  });


 // * - Resources Remove - config.stage2, config.region2 +
  describe('Test action: Resources remove', function() {

    describe('Resources remove positive tests', function() {

      it('removes a CF template', function() {

        let evt = {
          stage:      config.stage2,
          region:     config.region2,
          noExeCf:    config.noExecuteCf
        };

        let validateEvent = function(evt) {
          assert.equal(true, typeof evt.options.region !== 'undefined');
          assert.equal(true, typeof evt.options.stage !== 'undefined');
          assert.equal(true, typeof evt.data !== 'undefined');
        };

        return serverless.actions.resourcesRemove(evt)
          .then(validateEvent);
      });
    });
  });


 // * - Region Remove - config.stage2, config.region1 +

  describe('Test action: Region remove', function() {

    describe('Region remove positive tests', function() {

      it('removes a region', function() {

        let evt = {
          stage:      config.stage2,
          region:     config.region,
          noExeCf:    config.noExecuteCf
        };

        let validateEvent = function(evt) {
          assert.equal(true, typeof evt.options.region !== 'undefined');
          assert.equal(true, typeof evt.options.stage !== 'undefined');
          assert.equal(true, typeof evt.data !== 'undefined');
        };

        return serverless.actions.regionRemove(evt)
          .then(validateEvent);
      });
    });
  });

 // * - Stage Remove - config.stage1
  describe('Test action: Stage remove', function() {

    describe('Stage remove positive tests', function() {

      it('removes a stage', function() {

        let evt = {
          stage:      config.stage,
          noExeCf:    config.noExecuteCf
        };

        let validateEvent = function(evt) {
          assert.equal(true, typeof evt.options.stage !== 'undefined');
          assert.equal(true, typeof evt.data !== 'undefined');
        };

        return serverless.actions.stageRemove(evt)
          .then(validateEvent);
      });
    });
  });

 // * - Project Remove

  describe('Test Action: Project Remove', function() {

    describe('Project Remove positive tests', function() {
      it('should remove project', function() {
        let evt = {
          options: {
            noExeCf:    config.noExecuteCf
          }
        };

        let validateEvent = function(evt) {
          assert.equal(true, typeof evt.data !== 'undefined');
          assert.equal(true, typeof evt.data.project !== 'undefined');
          return evt;
        };

        return serverless.actions.projectRemove(evt)
          .then(validateEvent)
          .then(cleanup)
      });
    });
  });

});
