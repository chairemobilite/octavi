# Build Node app
FROM node:24-trixie
# Corepack runs the Yarn version set in the packageManager field of package.json, in place of the image's Yarn 1.
# It is installed from npm since Node.js 25+ no longer bundles it.
RUN npm install -g corepack
WORKDIR /app

# Install all the json package dependencies in an intermediary image. To do so, we copy each package.json files
# and run yarn install which will download all the listed packages in the image.
COPY package.json yarn.lock .yarnrc.yml ./
COPY ./packages/octavi-backend/package.json ./packages/octavi-backend/package.json
COPY ./packages/octavi-common/package.json ./packages/octavi-common/package.json
COPY ./packages/octavi-frontend/package.json ./packages/octavi-frontend/package.json
COPY ./packages/octavi-legacy/package.json ./packages/octavi-legacy/package.json
COPY ./transition/packages/chaire-lib-backend/package.json ./transition/packages/chaire-lib-backend/package.json
COPY ./transition/packages/chaire-lib-common/package.json ./transition/packages/chaire-lib-common/package.json
COPY ./transition/packages/chaire-lib-frontend/package.json ./transition/packages/chaire-lib-frontend/package.json
COPY ./transition/packages/transition-common/package.json ./transition/packages/transition-common/package.json
COPY ./transition/packages/transition-frontend/package.json ./transition/packages/transition-frontend/package.json
RUN yarn install --immutable

# Copy the rest. (node_modules are excluded in .dockerignore)
COPY . /app

# Setup the example as a default configuration for the image
COPY .env.example /app/.env

RUN yarn compile

# Start Node app
CMD yarn build:prod && yarn start
EXPOSE 8080
