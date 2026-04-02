// Jenkinsfile
// Pipeline for sat-changelog (ci repo is primary Jenkins checkout)
// Triggers on pushes to: main, staging, dev_staging_feature, feature/*
//
// Workspace layout:
//   .          ← ci repo (checked out by Jenkins)
//   scripts/   ← ci repo helper scripts
//   be/        ← ser005be cloned in 'Checkout BE' stage
//   fe/        ← ser005fe cloned in 'Checkout FE' stage

pipeline {

  agent any

  tools {
    nodejs 'node-20'   // Must match name in Global Tool Configuration → NodeJS
  }

  parameters {
    string(
      name: 'BRANCH_TO_BUILD',
      defaultValue: 'main',
      description: 'Branch to check out from be/ and fe/ repos. Injected by Generic Webhook Trigger on push.'
    )
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  environment {
    // ── Repo URLs ──────────────────────────────────────────────────────────
    BE_REPO_URL = 'https://github.com/zetta-novan-kuncoro/ser005be'
    FE_REPO_URL = 'https://github.com/zetta-novan-kuncoro/ser005fe'

    // ── YouTrack credentials (Jenkins credentials store) ───────────────────
    YOUTRACK_BASE_URL   = credentials('sat-changelog-youtrack-base-url')
    YOUTRACK_API_TOKEN  = credentials('sat-changelog-youtrack-api-token')
    YOUTRACK_PROJECT_ID = credentials('sat-changelog-youtrack-project-id')

    // ── Backend runtime credentials ────────────────────────────────────────
    MONGO_URI      = credentials('sat-changelog-mongo-uri')
    JWT_SECRET     = credentials('sat-changelog-jwt-secret')
    ENCRYPTION_KEY = credentials('sat-changelog-encryption-key')

    // ── E2E credentials ────────────────────────────────────────────────────
    E2E_ADMIN_EMAIL    = credentials('sat-changelog-e2e-admin-email')
    E2E_ADMIN_PASSWORD = credentials('sat-changelog-e2e-admin-password')

    // ── Issue reporter — branch policy + CI context ────────────────────────
    AUTOMATED_ISSUE_WRITE_BRANCHES = 'main,staging,dev_staging_feature'
    AUTOMATED_ISSUE_CI_BRANCH      = "${params.BRANCH_TO_BUILD}"
    AUTOMATED_ISSUE_CI_COMMIT      = "${env.GIT_COMMIT}"
    AUTOMATED_ISSUE_CI_RUN_URL     = "${env.BUILD_URL}"

    // ── Issue reporter — result file paths ────────────────────────────────
    // tools/automated-issue-reporting/config.js resolves these relative to
    // REPO_ROOT (__dirname/../..) = be/ root in the cloned workspace.
    AUTOMATED_ISSUE_BE_RESULTS_FILE      = 'be/test-results/jest-results.json'
    AUTOMATED_ISSUE_FE_RESULTS_FILE      = 'fe/test-results/playwright-results.json'
    AUTOMATED_ISSUE_FE_HTML_REPORT_INDEX = 'fe/playwright-report/index.html'

    // ── Internal ────────────────────────────────────────────────────────────
    BE_PID_FILE = "${env.WORKSPACE}/.be.pid"
  }

  stages {

    // ── Stage 1: Clone BE repo ─────────────────────────────────────────────
    // Try the pushed branch; fall back to main if it doesn't exist in be/.
    stage('Checkout BE') {
      steps {
        sh '''
          git clone "$BE_REPO_URL" be
          cd be
          git checkout "$BRANCH_TO_BUILD" 2>/dev/null || git checkout main
          echo "[CI] BE branch: $(git rev-parse --abbrev-ref HEAD)"
        '''
      }
    }

    // ── Stage 2: Clone FE repo ─────────────────────────────────────────────
    // Same branch strategy as BE.
    stage('Checkout FE') {
      steps {
        sh '''
          git clone "$FE_REPO_URL" fe
          cd fe
          git checkout "$BRANCH_TO_BUILD" 2>/dev/null || git checkout main
          echo "[CI] FE branch: $(git rev-parse --abbrev-ref HEAD)"
        '''
      }
    }

    // ── Stage 3: Install dependencies (parallel) ──────────────────────────
    stage('Install Dependencies') {
      parallel {

        stage('BE: npm ci') {
          steps {
            dir('be') {
              sh 'npm ci'
            }
          }
        }

        stage('FE: npm ci + Playwright browsers') {
          steps {
            dir('fe') {
              sh 'npm ci'
              sh 'npx playwright install chromium --with-deps'
            }
          }
        }

      }
    }

    // ── Stage 4: Backend unit tests ───────────────────────────────────────
    stage('Unit Tests (BE)') {
      steps {
        dir('be') {
          catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
            sh 'npm run test:json'
          }
        }
      }
    }

    // ── Stage 5: Start backend for E2E ────────────────────────────────────
    // scripts/ is at workspace root (ci repo root). start-backend.sh cds
    // into be/ before launching node.
    stage('Start Backend') {
      steps {
        sh 'chmod +x scripts/start-backend.sh scripts/wait-for-backend.sh'
        sh 'scripts/start-backend.sh'
        sh 'scripts/wait-for-backend.sh'
      }
    }

    // ── Stage 6: Frontend E2E tests ───────────────────────────────────────
    // CI=true → playwright.config.cjs sets reuseExistingServer: false and
    // retries: 2, and auto-starts the Vite dev server via webServer config.
    stage('E2E Tests (FE)') {
      environment {
        CI = 'true'
      }
      steps {
        dir('fe') {
          catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
            sh 'npm run test:e2e'
          }
        }
      }
    }

  }

  // ── Post: always runs regardless of stage outcome ─────────────────────────
  post {
    always {

      // 1. Stop backend process
      sh '''
        if [ -f "$BE_PID_FILE" ]; then
          BE_PID=$(cat "$BE_PID_FILE")
          if kill -0 "$BE_PID" 2>/dev/null; then
            echo "[CI] Stopping backend (PID $BE_PID)"
            kill "$BE_PID" || true
            sleep 5
            kill -9 "$BE_PID" 2>/dev/null || true
          fi
          rm -f "$BE_PID_FILE"
        else
          echo "[CI] No PID file found; backend may not have started"
        fi
      '''

      // 2. Run automated issue reporter — always, even when tests fail.
      //    A YouTrack API outage must not flip a passing build to FAILURE.
      catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
        dir('be') {
          sh 'npm run report:auto-issues'
        }
      }

      // 3. Archive test result JSON files
      archiveArtifacts(
        artifacts: [
          'be/test-results/jest-results.json',
          'fe/test-results/playwright-results.json',
          'fe/playwright-report/**/*'
        ].join(','),
        allowEmptyArchive: true
      )

      // 4. Publish Playwright HTML report as a build page
      publishHTML(target: [
        allowMissing         : true,
        alwaysLinkToLastBuild: true,
        keepAll              : true,
        reportDir            : 'fe/playwright-report',
        reportFiles          : 'index.html',
        reportName           : 'Playwright E2E Report'
      ])

    }
  }

}
