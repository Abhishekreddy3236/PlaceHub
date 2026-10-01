module.exports = {
  apps: [
    {
      name: 'placehub-api',
      script: './server.js',
      // Run in single-instance fork mode to guarantee stateful memory (e.g. rate limiters)
      // remains centralized and accurate, avoiding the need for Redis.
      instances: 1,
      exec_mode: 'fork',

      // Auto-restart if the app crashes
      autorestart: true,

      // Do not watch files in production to save CPU and avoid accidental restarts
      watch: false,

      // 5-second restart delay prevents CPU thrashing if the app crashes repeatedly on boot
      restart_delay: 5000,

      // DigitalOcean Premium Intel droplet has 2GB RAM. 
      // 400M is a safe ceiling that allows enough headroom for file uploads
      // while guaranteeing PM2 will restart the process BEFORE it exhausts the host OS memory
      // and triggers the Linux OOM killer.
      max_memory_restart: '600M',

      // Prefix PM2 stdout/stderr logs with timestamps. This ensures that any native Node.js
      // crashes (e.g., OOM errors) that bypass Winston will still have accurate timestamps.
      time: true,

      env: {
        NODE_ENV: 'production',
        UV_THREADPOOL_SIZE: '6',
      },
    },
  ],
};
