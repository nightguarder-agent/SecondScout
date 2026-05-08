<script lang="ts">
    import pkg from '../../package.json';
    // Attempt to read commit hash from an environment variable set at build time
    const commit = import.meta.env.VITE_COMMIT_HASH || 'unknown';
    const deploy = import.meta.env.VITE_DEPLOY_ENV || 'netlify';
</script>

<div class="text-xs text-gray-500 mt-4 text-center">
    Version: {pkg.version} | Commit: {commit} | Deployed on: {deploy}
</div>
