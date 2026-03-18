const [major] = process.versions.node.split('.').map(Number)

if (Number.isNaN(major) || major < 20) {
  console.error(
    [
      `Unsupported Node runtime: ${process.versions.node}`,
      'Fireplanner requires Node 20+ for the frontend toolchain.',
      'Use `nvm use`, `fnm use`, or another version manager in this repo before running npm scripts.',
    ].join('\n')
  )
  process.exit(1)
}
