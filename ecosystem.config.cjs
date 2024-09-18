module.exports = {
    apps: [
      {
        name: "forecastWorkflow",
        script: "./forecastsV2/index.js",
        watch: true,
        env: {
          NODE_ENV: "production",
          PORT: 3000
        },
        env_file: "/home/ubuntu/gustbackend-fresh/.env"
      }
    ]
  };
  