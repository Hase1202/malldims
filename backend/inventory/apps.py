from django.apps import AppConfig


class InventoryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "inventory"
    
    def ready(self):
        # Configure admin site branding when the app is ready
        from django.contrib import admin
        admin.site.site_header = "AGMall Beauty Products IMS"
        admin.site.site_title = "AGMall Admin"
        admin.site.index_title = "Welcome to AGMall Beauty Products Inventory Management"