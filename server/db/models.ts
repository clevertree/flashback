import 'reflect-metadata';
import {
    AllowNull,
    AutoIncrement,
    Column,
    DataType,
    ForeignKey,
    HasMany,
    Model,
    PrimaryKey,
    Sequelize,
    Table,
    Unique
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

    // @AllowNull(false)
    // @Column(DataType.ENUM('user', 'admin'))
    // type!: UserModelerType;

    @Unique
    @AllowNull(false)
    @Column(DataType.STRING(256))
    email!: string;

    // @Unique
    // @AllowNull(false)
    // @Column(DataType.STRING(256))
    // publicKeyHash!: string;

    @AllowNull(false)
    @Column(DataType.TEXT)
    certificate!: string;

    @HasMany(() => BroadcastSourceModel)
    uploads!: BroadcastSourceModel[];
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
        RepositoryModel,
    ]
});

// Initialize database connection
export async function initDatabase() {
    try {
        // await sequelize.authenticate();
        await sequelize.sync({
            alter: false,
            force: false,
            logging: console.log
        });
        console.log('Database connection established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        throw error;
    }
}

export {sequelize}
