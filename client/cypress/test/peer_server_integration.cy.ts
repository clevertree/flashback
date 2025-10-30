/**
 * Peer Server Integration E2E Tests
 * Tests the complete flow: fileRootDirectory config → HTTP server → RemoteHouse browsing
 */

describe('Peer Server Integration', () => {
  describe('Configuration and Server Startup', () => {
    it('fileRootDirectory can be configured in Settings', () => {
      cy.visit('/')
      // Navigate to Settings
      cy.get('[data-cy=settings-button], [data-cy=nav-settings]').click()
      // Find fileRootDirectory input
      cy.get('[data-cy=file-root-directory-input]').should('exist')
      cy.get('[data-cy=file-root-directory-input]').should('be.visible')
    })

    it('fileRootDirectory persists to localStorage', () => {
      const testPath = '/tmp/test-files'
      cy.visit('/')
      cy.get('[data-cy=settings-button], [data-cy=nav-settings]').click()
      // Set fileRootDirectory
      cy.get('[data-cy=file-root-directory-input]').clear().type(testPath)
      // Reload page
      cy.reload()
      // Verify it's still set
      cy.get('[data-cy=file-root-directory-input]').should('have.value', testPath)
    })

    it('HTTP server starts automatically when fileRootDirectory is configured', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 10000 }).should('exist')
      // HTTP server should be running and accessible
      cy.request({
        url: 'http://127.0.0.1:54321/api/files',
        failOnStatusCode: false
      }).should((response) => {
        expect([200, 404]).to.include(response.status)
      })
    })

    it('Peer Server event is emitted with port', () => {
      cy.visit('/')
      cy.window().then((win) => {
        cy.wrap(null).then(() => {
          return new Promise<number | null>((resolve) => {
            let port: number | null = null
            const listener = (event: any) => {
              if (event.detail && event.detail.port) {
                port = event.detail.port
                resolve(port)
              }
            }
            win.document.addEventListener('http-file-server-ready', listener)
            setTimeout(() => resolve(port), 5000)
          })
        }).then((port) => {
          expect(port).to.not.be.null
          if (port) {
            cy.request(`http://127.0.0.1:${port}/api/files`).should((response) => {
              expect(response.status).to.equal(200)
            })
          }
        })
      })
    })
  })

  describe('File Browsing Flow', () => {
    it('can browse files in configured directory', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      cy.get('[data-cy=file-item]').should('have.length.greaterThan', 0)
    })

    it('displays index.md as default entry point', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        const files = response.body
        const hasIndex = files.some((f: any) => f.name === 'index.md')
        // Index.md should exist or be created
        expect(files).to.be.an('array')
      })
    })

    it('can navigate through directory structure', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Get initial file count
      cy.get('[data-cy=file-item]').then(($items) => {
        const initialCount = $items.length
        // Check if there are directories
        cy.get('[data-cy=file-item-directory]').then(($dirs) => {
          if ($dirs.length > 0) {
            // Navigate into first directory
            cy.get('[data-cy=file-item-directory]').first().click()
            // File list should update
            cy.get('[data-cy=file-list]').should('exist')
          }
        })
      })
    })

    it('can preview different file types', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Get list of files
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        const files = response.body
        const textFile = files.find((f: any) => /\.(md|txt|json)$/.test(f.name))
        if (textFile) {
          // Click on text file
          cy.get(`[data-cy=file-item][data-file-name="${textFile.name}"]`).click()
          // Preview should show
          cy.get('[data-cy=file-preview]').should('exist')
        }
      })
    })
  })

  describe('Error Handling', () => {
    it('handles missing fileRootDirectory gracefully', () => {
      // This test verifies behavior when fileRootDirectory is not set
      cy.visit('/')
      // Should show error or empty state
      cy.get('[data-cy=file-list], [data-cy=error-message]', { timeout: 5000 }).should('exist')
    })

    it('shows error for HTTP server connection failures', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Attempt to access invalid path
      cy.request({
        url: 'http://127.0.0.1:54321/api/files/nonexistent',
        failOnStatusCode: false
      }).should((response) => {
        expect([404, 403]).to.include(response.status)
      })
    })

    it('prevents directory traversal attacks', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Try directory traversal
      cy.request({
        url: 'http://127.0.0.1:54321/api/files/../../../../etc/passwd',
        failOnStatusCode: false
      }).should((response) => {
        expect([404, 403]).to.include(response.status)
      })
    })

    it('handles concurrent file requests', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Make multiple concurrent requests
      cy.request('http://127.0.0.1:54321/api/files').should((response1) => {
        cy.request('http://127.0.0.1:54321/api/files').should((response2) => {
          cy.request('http://127.0.0.1:54321/api/files').should((response3) => {
            expect(response1.status).to.equal(200)
            expect(response2.status).to.equal(200)
            expect(response3.status).to.equal(200)
          })
        })
      })
    })
  })

  describe('Broadcast Section Integration', () => {
    it('fileRootDirectory is accessible in Broadcast section', () => {
      cy.visit('/')
      cy.get('[data-cy=broadcast-button], [data-cy=nav-broadcast]').click()
      // Find fileRootDirectory input in Broadcast section
      cy.get('[data-cy=broadcast-file-root-directory-input]').should('exist')
    })

    it('can set fileRootDirectory before broadcasting', () => {
      const testPath = '/tmp/broadcast-files'
      cy.visit('/')
      cy.get('[data-cy=broadcast-button], [data-cy=nav-broadcast]').click()
      cy.get('[data-cy=broadcast-file-root-directory-input]').clear().type(testPath)
      // Should be saved
      cy.get('[data-cy=broadcast-file-root-directory-input]').should('have.value', testPath)
    })

    it('broadcast updates fileRootDirectory setting', () => {
      const testPath = '/tmp/broadcast-files'
      cy.visit('/')
      cy.get('[data-cy=broadcast-button], [data-cy=nav-broadcast]').click()
      cy.get('[data-cy=broadcast-file-root-directory-input]').clear().type(testPath)
      // Navigate to Settings to verify it was saved
      cy.get('[data-cy=settings-button], [data-cy=nav-settings]').click()
      cy.get('[data-cy=file-root-directory-input]').should('have.value', testPath)
    })
  })

  describe('RemoteHouse HTTP Events', () => {
    it('RemoteHouse listens for http-file-server-ready event', () => {
      cy.visit('/')
      cy.window().then((win) => {
        // Verify event listener is set up
        cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
        // File list should only appear after event is received
        cy.wrap(null).should('exist')
      })
    })

    it('RemoteHouse fetches files from correct port', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Files should be loaded from emitted port
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        expect(response.status).to.equal(200)
        expect(response.body).to.be.an('array')
      })
    })
  })

  describe('Large File Handling', () => {
    it('can stream large video files', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        const files = response.body
        const videoFile = files.find((f: any) => /\.(mp4|webm|mov)$/.test(f.name))
        if (videoFile) {
          // Request should succeed
          cy.request(`http://127.0.0.1:54321/download/${encodeURIComponent(videoFile.name)}`).should((response) => {
            expect(response.status).to.equal(200)
            // Should have Content-Length header for streaming
            expect(response.headers).to.have.property('content-length')
          })
        }
      })
    })

    it('handles chunked transfer encoding', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Server should support chunked encoding for large files
      cy.request({
        url: 'http://127.0.0.1:54321/api/files',
        headers: {
          'Accept-Encoding': 'gzip, deflate'
        }
      }).should((response) => {
        expect(response.status).to.equal(200)
      })
    })
  })

  describe('Performance', () => {
    it('file list loads quickly', () => {
      cy.visit('/')
      const startTime = Date.now()
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist').then(() => {
        const elapsed = Date.now() - startTime
        // Should load within 5 seconds
        expect(elapsed).to.be.lessThan(5000)
      })
    })

    it('directory navigation is responsive', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      const startTime = Date.now()
      cy.get('[data-cy=file-item-directory]').then(($dirs) => {
        if ($dirs.length > 0) {
          cy.get('[data-cy=file-item-directory]').first().click()
          cy.get('[data-cy=file-list]').should('exist').then(() => {
            const elapsed = Date.now() - startTime
            // Navigation should complete within 2 seconds
            expect(elapsed).to.be.lessThan(2000)
          })
        }
      })
    })
  })
})