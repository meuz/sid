class ActivosRouter:
    app_label = 'inventario'

    def db_for_read(self, model, **hints):
        if model._meta.app_label == self.app_label and model.__name__ == 'Activo':
            return 'activos'
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label == self.app_label and model.__name__ == 'Activo':
            return 'activos'
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == self.app_label and model_name == 'activo':
            return False
        return None
