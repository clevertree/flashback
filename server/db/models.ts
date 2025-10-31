import 'reflect-metadata';
import {
    AllowNull,
    AutoIncrement,
    BelongsTo,
    Column,
    DataType,
    Default,
    ForeignKey,
    HasMany,
    Model,
    PrimaryKey,
    Sequelize,
    Table,
    Unique,
    Index
} from 'sequelize-typescript';

// User model with decorators
import pg from 'pg';

@Table({
    tableName: 'user',
    timestamps: true, // Automatically add createdAt and updatedAt columns
    paranoid: false // Add deletedAt column for soft deletes
})
export class UserModel extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    id!: number;

    @Unique
    @AllowNull(false)
    @Column(DataType.STRING(256))
    email!: string;

    @AllowNull(false)
    @Column(DataType.TEXT)
    certificate!: string;

    @HasMany(() => BroadcastSourceModel)
    uploads!: BroadcastSourceModel[];

    @HasMany(() => BroadcastModel)
    broadcasts!: BroadcastModel[];
}

@Table({
    tableName: 'broadcast_source',
    timestamps: true, // Automatically add createdAt and updatedAt columns
    paranoid: false // Add deletedAt column for soft deletes
})
export class BroadcastSourceModel extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    id!: number;

    @ForeignKey(() => UserModel)
    @AllowNull(false)
    @Column(DataType.INTEGER)
    user_id!: number | null;

    @AllowNull(false)
    @Column(DataType.STRING(256))
    socket_address!: string;
}

// New Broadcast model for Relay Tracker
@Table({
    tableName: 'broadcast',
    timestamps: true,
    paranoid: false
})
export class BroadcastModel extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    id!: number;

    @ForeignKey(() => UserModel)
    @AllowNull(false)
    @Column(DataType.INTEGER)
    user_id!: number;

    @BelongsTo(() => UserModel)
    user!: UserModel;

    @AllowNull(false)
    @Column(DataType.INTEGER)
    port!: number;

    @AllowNull(false)
    @Column(DataType.JSON)
    addresses!: string[];

    @AllowNull(true)
    @Column(DataType.JSON)
    capabilities!: Record<string, any> | null;

    @AllowNull(false)
    @Default(DataType.NOW)
    @Column(DataType.DATE)
    created_at!: Date;

    @AllowNull(false)
    @Column(DataType.DATE)
    expires_at!: Date;

    @AllowNull(true)
    @Column(DataType.DATE)
    last_heartbeat!: Date | null;
}

@Table({
    tableName: 'repository',
    timestamps: true, // Automatically add createdAt and updatedAt columns
    paranoid: true // Add deletedAt column for soft deletes
})
export class RepositoryModel extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    id!: number;

    @Unique
    @AllowNull(false)
    @Column(DataType.STRING(256))
    title!: string;

    @AllowNull(false)
    @Column(DataType.STRING(512))
    url!: string;
}

const databaseUrl = process.env.PGSQL_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('PGSQL_DATABASE_URL environment variable is required');
}

// Database connection with sequelize-typescript
const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectModule: pg,
    logging: false, // Set to console.log to see SQL queries
    models: [
        UserModel,
        BroadcastSourceModel,
        BroadcastModel,
        RepositoryModel,
    ]
});

// Initialize database connection
export async function initDatabase() {
    try {
        const isTestMode =
            process.env.NODE_ENV === 'test' ||
            process.env.CYPRESS_RESET_DB === 'true' ||
            process.env.TEST_MODE === 'true';

        await sequelize.sync({
            alter: true,
            force: false,
            logging: isTestMode ? console.log : false
        });
        console.log('Database connection established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        throw error;
    }
}

export {sequelize}
