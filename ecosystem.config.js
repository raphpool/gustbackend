module.exports = {
    apps: [
      {
        name: "forecastsV2",
        script: "./forecastsV2/index.js",
        watch: true,
        // other settings as needed
      },
      {
        name: "directionMap",
        script: "./directionMap/index.mjs",
        interpreter: "/usr/bin/node",
        env: {
          PATH: "/home/ubuntu/GUSTBackend/venv/bin:$PATH",
          PYTHONPATH: "/home/ubuntu/GUSTBackend/venv/lib/python3.x/site-packages",
          VIRTUAL_ENV: "/home/ubuntu/GUSTBackend/venv"
        },
        exec_mode: "fork",
        autorestart: false,
      },
      {
        name: "speedMap",
        script: "./speedMap/index.js",
        exec_mode: "fork",
        autorestart: false,
        // This won't auto-start, we'll use cron for this
      }
    ]
  };
  