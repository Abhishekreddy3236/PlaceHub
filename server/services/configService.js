const Config = require('../models/Config');
const AppError = require('../utils/AppError');
const buildConfigUpdate = require('../utils/buildConfigUpdate');

const GLOBAL_CONFIG_ID = 'global_config';

exports.updateConfig = async (data) => {
  const updateFields = buildConfigUpdate(data);

  if (Object.keys(updateFields).length === 0) {
    throw new AppError('No valid fields provided for update', 400);
  }

  await Config.findByIdAndUpdate(
    GLOBAL_CONFIG_ID,
    { $set: updateFields },
    { new: true, upsert: true, runValidators: true }
  );
  
  Config.clearGlobalConfigCache();
  return Config.getGlobalConfig();
};

exports.getConfig = async () => {
  return Config.getGlobalConfig();
};
