const queryHooks = [
  'countDocuments',
  'find',
  'findOne',
  'findOneAndUpdate',
  'updateMany',
  'updateOne',
];

module.exports = function softDeletePlugin(schema) {
  const hasIsDeleted = Boolean(schema.path('isDeleted'));

  if (!hasIsDeleted) {
    return;
  }

  const excludeDeleted = function excludeDeleted(next) {
    const filter = this.getFilter();
    const options = this.getOptions();

    if (!Object.prototype.hasOwnProperty.call(filter, 'isDeleted') && !options.withDeleted) {
      this.where({ isDeleted: false });
    }

    next();
  };

  queryHooks.forEach((hook) => {
    schema.pre(hook, excludeDeleted);
  });

  schema.pre('aggregate', function excludeDeletedFromAggregate(next) {
    const pipeline = this.pipeline();
    const firstStage = pipeline[0];
    const hasExplicitDeletedMatch =
      firstStage &&
      firstStage.$match &&
      Object.prototype.hasOwnProperty.call(firstStage.$match, 'isDeleted');

    if (!this.options?.withDeleted && !hasExplicitDeletedMatch) {
      pipeline.unshift({ $match: { isDeleted: false } });
    }

    next();
  });

  schema.methods.softDelete = function softDelete() {
    this.isDeleted = true;

    if (schema.path('isActive')) {
      this.isActive = false;
    }

    return this.save();
  };
};
