module.exports = {
    verbose: true,
    transform: {
        "^.+\\.js?$": "babel-jest",
        '^.+\\.ts?$': 'ts-jest'
    },
    testEnvironment: 'node',
    testRegex: '/test/.*\\.(test|spec)?\\.(js|tsx)$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        "@Root(.*)$": '<rootDir>/dist/src/$1',
        "@Data(.*)$": '<rootDir>/dist/src/data$1',
        "@Helpers(.*)$": '<rootDir>/dist/src/helpers$1',
        "@Controllers(.*)$":'<rootDir>/dist/src/controllers$1'
      }
};