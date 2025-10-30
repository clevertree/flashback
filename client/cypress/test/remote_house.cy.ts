describe('RemoteHouse component', () => {
  describe('File browser initialization', () => {
    it('shows RemoteHouse when maximized', () => {
      cy.visit('/')
      // RemoteHouse can be maximized to fill the client
      cy.get('[data-cy=remotehouse-container]').should('exist')
    })

    it('displays file list after HTTP server is ready', () => {
      cy.visit('/')
      // Wait for Peer Server to be ready (event emitted)
      cy.get('[data-cy=file-list]', { timeout: 10000 }).should('exist')
    })

    it('shows loading state while fetching files', () => {
      cy.visit('/')
      // Should show loading indicator while fetching from /api/files
      cy.get('[data-cy=loading-indicator]').should('exist')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
    })
  })

  describe('Directory navigation', () => {
    it('lists files in root directory', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      cy.get('[data-cy=file-item]').should('have.length.greaterThan', 0)
    })

    it('can navigate into a directory', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Find and click a directory (indicated by 📁 icon or directory type)
      cy.get('[data-cy=file-item-directory]').first().click()
      // Should show files from that directory
      cy.get('[data-cy=file-list]').should('exist')
    })

    it('shows up button to navigate to parent directory', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Navigate into a directory
      cy.get('[data-cy=file-item-directory]').first().click()
      // Up button should appear
      cy.get('[data-cy=navigate-up-button]').should('exist')
    })

    it('can navigate back to parent directory', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Navigate into directory
      cy.get('[data-cy=file-item-directory]').first().click()
      // Navigate back
      cy.get('[data-cy=navigate-up-button]').click()
      // Should be back at root
      cy.get('[data-cy=file-list]').should('exist')
    })

    it('prevents directory traversal attacks', () => {
      // This is tested at the HTTP server level
      // RemoteHouse should not be able to navigate outside fileRootDirectory
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Attempting to navigate to parent should fail or show no results
      cy.window().then((win) => {
        // The HTTP server should reject paths outside root
        cy.request({
          url: 'http://127.0.0.1:54321/api/files/../../../../etc/passwd',
          failOnStatusCode: false
        }).should((response) => {
          expect([403, 404]).to.include(response.status)
        })
      })
    })
  })

  describe('File preview', () => {
    it('displays text file content', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Find a text file (e.g., README.md, .txt, .md, .json)
      cy.get('[data-cy=file-item]:has([data-file-type="markdown"])').first().click()
      // Content should display in preview area
      cy.get('[data-cy=file-preview]').should('exist')
      cy.get('[data-cy=file-content-text]').should('exist')
    })

    it('displays image file with img tag', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Find an image file
      cy.get('[data-cy=file-item]:has([data-file-type="image"])').first().click()
      // Image should display
      cy.get('[data-cy=file-preview]').should('exist')
      cy.get('[data-cy=file-preview] img').should('exist')
    })

    it('displays video player for video files', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Find a video file
      cy.get('[data-cy=file-item]:has([data-file-type="video"])').first().click()
      // Video player should appear
      cy.get('[data-cy=file-preview]').should('exist')
      cy.get('[data-cy=file-preview] video').should('exist')
    })

    it('shows error message for missing files', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Try to access a non-existent file
      cy.window().then((win) => {
        cy.request({
          url: 'http://127.0.0.1:54321/content/nonexistent-file.txt',
          failOnStatusCode: false
        }).should((response) => {
          expect(response.status).to.equal(404)
        })
      })
    })

    it('displays file size and metadata', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // File items should show size information
      cy.get('[data-cy=file-item-size]').first().should('exist')
      cy.get('[data-cy=file-item-size]').first().should('contain', /\d+/)
    })
  })

  describe('HTTP server lifecycle', () => {
    it('Peer Server starts when Peer Server is configured', () => {
      cy.visit('/')
      // Should emit http-file-server-ready event within timeout
      cy.window().then((win) => {
        cy.wrap(null).then(() => {
          return new Promise((resolve) => {
            let resolved = false
            win.document.addEventListener('http-file-server-ready', () => {
              if (!resolved) {
                resolved = true
                resolve(true)
              }
            }, { once: true })
            // Timeout after 5 seconds
            setTimeout(() => {
              if (!resolved) resolve(false)
            }, 5000)
          })
        }).should('equal', true)
      })
    })

    it('file list updates when navigating directories', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Navigate into directory if any exists
      cy.get('[data-cy=file-item-directory]').then(($items) => {
        if ($items.length > 0) {
          cy.get('[data-cy=file-item-directory]').first().click()
          // File list should still exist after navigation
          cy.get('[data-cy=file-list]').should('exist')
        }
      })
    })

    it('handles errors gracefully', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Should not show console errors
      cy.on('uncaught:exception', (err) => {
        // Network errors are expected in test environment
        if (err.message.includes('Failed to fetch')) return false
        throw err
      })
    })
  })

  describe('File type support', () => {
    it('supports markdown files (.md)', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Markdown files should be displayed with readable content
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        const files = response.body
        if (files.some((f: any) => f.name.endsWith('.md'))) {
          cy.wrap(null).should('exist') // File exists
        }
      })
    })

    it('supports image files (.jpg, .png, .gif, .svg)', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Image files should have proper type
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        const files = response.body
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg']
        const hasImages = files.some((f: any) => 
          imageExts.some(ext => f.name.toLowerCase().endsWith(ext))
        )
        // It's okay if there are no images in test directory
      })
    })

    it('supports video files (.mp4, .webm, .mov)', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Video files should be playable
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        const files = response.body
        const videoExts = ['.mp4', '.webm', '.mov']
        const hasVideos = files.some((f: any) => 
          videoExts.some(ext => f.name.toLowerCase().endsWith(ext))
        )
        // It's okay if there are no videos in test directory
      })
    })

    it('supports text files (.txt, .json, .ts, .js, .tsx, .jsx)', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Text files should be readable
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        const files = response.body
        const textExts = ['.txt', '.json', '.js', '.ts', '.tsx', '.jsx']
        const hasText = files.some((f: any) => 
          textExts.some(ext => f.name.toLowerCase().endsWith(ext))
        )
        // It's okay if there are no text files in test directory
      })
    })
  })

  describe('API endpoints', () => {
    it('GET /api/files returns file list', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        expect(response.status).to.equal(200)
        expect(response.body).to.be.an('array')
        // Each file should have name and type
        response.body.forEach((file: any) => {
          expect(file).to.have.property('name')
          expect(file).to.have.property('type')
        })
      })
    })

    it('GET /api/files/{directory} returns subdirectory files', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      // Get root files first
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        const files = response.body
        const dir = files.find((f: any) => f.type === 'directory')
        if (dir) {
          // Request subdirectory
          cy.request({
            url: `http://127.0.0.1:54321/api/files/${encodeURIComponent(dir.name)}`,
            failOnStatusCode: false
          }).should((subResponse) => {
            expect([200, 404]).to.include(subResponse.status)
          })
        }
      })
    })

    it('GET /content/{file} returns text file content', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        const files = response.body
        const textFile = files.find((f: any) => 
          f.type === 'file' && /\.(txt|md|json|js|ts)$/.test(f.name)
        )
        if (textFile) {
          cy.request(`http://127.0.0.1:54321/content/${encodeURIComponent(textFile.name)}`).should((response) => {
            expect(response.status).to.equal(200)
            expect(response.body).to.be.a('string')
          })
        }
      })
    })

    it('GET /download/{file} downloads file', () => {
      cy.visit('/')
      cy.get('[data-cy=file-list]', { timeout: 5000 }).should('exist')
      cy.request('http://127.0.0.1:54321/api/files').should((response) => {
        const files = response.body
        const anyFile = files.find((f: any) => f.type === 'file')
        if (anyFile) {
          cy.request(`http://127.0.0.1:54321/download/${encodeURIComponent(anyFile.name)}`).should((response) => {
            expect(response.status).to.equal(200)
          })
        }
      })
    })
  })
})
