module.exports = {
  apps: [
    {
      name: "forecastWorkflow",
      script: "./forecastsV2/index.mjs",
      watch: true,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        PATH: "/home/ubuntu/gustbackend-fresh/node_modules/.bin:$PATH"
      },
      env_file: "/home/ubuntu/gustbackend-fresh/.env",
      interpreter: "/usr/bin/node",
      node_args: ["--experimental-modules", "--es-module-specifier-resolution=node"]
    }
  ]
};
